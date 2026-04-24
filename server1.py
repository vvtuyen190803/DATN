from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import shutil
import os
import json
import subprocess
import time
import glob

app = FastAPI(title="Hệ thống AI Giám sát giao thông và phát hiện xe vi phạm tốc độ")

# 1. Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Khai báo các đường dẫn
VIOLATION_DIR = "temp_results/violations"
UPLOAD_DIR = "temp_uploads"
RESULT_DIR = "temp_results"

# 3. BIẾN LƯU LỊCH SỬ TRÊN RAM (Sẽ mất khi tắt Server)
HISTORY_LOG = []

# 4. HÀM DỌN DẸP KHI KHỞI ĐỘNG
def startup_cleanup():
    global HISTORY_LOG
    HISTORY_LOG = [] # Xóa sạch mảng lịch sử trên RAM
    print("Đang dọn dẹp kho lưu trữ...")
    folders = [UPLOAD_DIR, VIOLATION_DIR, RESULT_DIR]
    for folder in folders:
        if os.path.exists(folder):
            for f in os.listdir(folder):
                file_path = os.path.join(folder, f)
                try:
                    if os.path.isfile(file_path): os.unlink(file_path)
                except Exception as e: print(f"Lỗi xóa {f}: {e}")
    print("Đã dọn dẹp xong")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULT_DIR, exist_ok=True)
os.makedirs(VIOLATION_DIR, exist_ok=True)

app.mount("/results", StaticFiles(directory=RESULT_DIR), name="results")

# --- MODEL NHẬN DỮ LIỆU ĐĂNG NHẬP ---
class LoginRequest(BaseModel):
    username: str
    password: str

# --- API 0: ĐĂNG NHẬP HỆ THỐNG ---
@app.post("/api/login")
async def login(credentials: LoginRequest):
    # Hard-code tài khoản Quản trị viên
    if credentials.username == "admin" and credentials.password == "admin123":
        # Cấp phát Token giả lập chuẩn JWT
        return {
            "status": "success", 
            "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.admin_payload.signature_xxx",
            "role": "admin"
        }
    else:
        raise HTTPException(status_code=401, detail="Tài khoản hoặc mật khẩu không chính xác")

# --- API 1: PHÂN TÍCH VÀ LƯU LỊCH SỬ ---
@app.post("/api/analyze-speed")
async def analyze_speed(
    video: UploadFile = File(...),
    points: str = Form(...),
    width_m: float = Form(...),
    length_m: float = Form(...),
    speed_limit: float = Form(...)
):
    unique_id = int(time.time())
    safe_filename = f"{unique_id}_{video.filename}"
    temp_video_path = f"{UPLOAD_DIR}/{safe_filename}"
   
    with open(temp_video_path, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)
   
    pts_list = json.loads(points)
    raw_drawn_video = f"{RESULT_DIR}/raw_{safe_filename}"
    web_ready_video = f"{RESULT_DIR}/web_{safe_filename}"

    ai_config = {
        'source': temp_video_path,
        'points': pts_list,
        'width_m': width_m,
        'length_m': length_m,
        'speed_limit': speed_limit,
        'yolo_model': 'weights/visDrone.pt',
        'tracking_method': 'bytetrack',
        'conf': 0.25,
        'device': 'cpu',
        'classes': [2, 3, 4, 5, 8, 9],
        'output_path': raw_drawn_video
    }

    try:
        from scenario.track import run
        run(ai_config)
       
        # FFmpeg trỏ ổ D
        ffmpeg_exe = r"D:\ffmpeg\bin\ffmpeg.exe"
        subprocess.run([ffmpeg_exe, "-y", "-i", raw_drawn_video, "-vcodec", "libx264", "-preset", "ultrafast", "-crf", "28", web_ready_video])
       
        # LƯU VÀO RAM BACKEND
        result_data = {
            "id": unique_id,
            "video_url": f"http://localhost:8000/results/web_{safe_filename}",
            "filename": video.filename,
            "speed_limit": speed_limit,
            "timestamp": time.strftime("%H:%M:%S - %d/%m/%Y")
        }
        HISTORY_LOG.insert(0, result_data) # Đưa lên đầu danh sách
        return result_data

    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

# --- API 2: LẤY LỊCH SỬ TỪ RAM ---
@app.get("/api/history")
async def get_history():
    return HISTORY_LOG

# --- API 3: LẤY ẢNH VI PHẠM TỪ Ổ CỨNG ---
@app.get("/api/violations")
async def get_violations():
    import os
    # Đảm bảo thư mục tồn tại
    if not os.path.exists(VIOLATION_DIR):
        return []
   
    # Lấy danh sách file trực tiếp từ thư mục
    try:
        files = [f for f in os.listdir(VIOLATION_DIR) if f.lower().endswith('.jpg')]
        # Sắp xếp theo thời gian sửa đổi (mới nhất lên đầu)
        files.sort(key=lambda x: os.path.getmtime(os.path.join(VIOLATION_DIR, x)), reverse=True)
       
        # Tạo danh sách URL chuẩn
        image_list = []
        for f in files:
            image_list.append({
                "url": f"http://localhost:8000/results/violations/{f}",
                "filename": f
            })
        return image_list
    except Exception as e:
        print(f"Lỗi khi lấy danh sách ảnh: {e}")
        return []

# --- API 4: XÓA SẠCH (THỦ CÔNG) ---
@app.delete("/api/clear-all")
async def clear_all():
    global HISTORY_LOG
    HISTORY_LOG = []
    startup_cleanup()
    return {"message": "Đã làm mới toàn bộ hệ thống!"}

if __name__ == "__main__":
    startup_cleanup()
    uvicorn.run(app, host="0.0.0.0", port=8000)