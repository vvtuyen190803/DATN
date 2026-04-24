from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import shutil
import os
import json
import subprocess
import time

app = FastAPI(title="Hệ thống Đo tốc độ AI - Bản chạy CPU cho máy cũ")

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tạo thư mục nếu chưa có
os.makedirs("temp_uploads", exist_ok=True)
os.makedirs("temp_results", exist_ok=True)

# Mount thư mục để React có thể truy cập video kết quả
app.mount("/results", StaticFiles(directory="temp_results"), name="results")

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
    
    print(f"--- 💻 CHẾ ĐỘ CPU: ĐANG XỬ LÝ {safe_filename} ---")
    
    # 1. Lưu file video gốc
    temp_video_path = f"temp_uploads/{safe_filename}"
    with open(temp_video_path, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)
    
    pts_list = json.loads(points)
    raw_drawn_video = f"temp_results/raw_{safe_filename}"
    web_ready_video = f"temp_results/web_{safe_filename}"

    # 🟢 THAY ĐỔI 1: Cấu hình AI chạy trên CPU
    ai_config = {
        'source': temp_video_path,
        'points': pts_list,
        'width_m': width_m,
        'length_m': length_m,
        'speed_limit': speed_limit,
        'yolo_model': 'weights/yolov8n.pt', # Nên dùng bản Nano để CPU không quá tải
        'tracking_method': 'bytetrack',
        'conf': 0.25,
        'save': False,
        'device': 'cpu',  # 🚀 ĐÃ ĐỔI: Chạy bằng CPU thay vì '0'
        'classes': [1, 2, 3, 5, 7], 
        'iou': 0.7,      
        'show': False,
        'output_path': raw_drawn_video 
    }

    # 2. CHẠY AI
    from scenario.track import run
    run(ai_config)
    
    # 🟢 THAY ĐỔI 2: Convert Video bằng CPU Encoder
    # Vì máy cũ không có h264_nvenc, ta dùng libx264
    ffmpeg_cmd = [
        "ffmpeg", "-y", 
        "-i", raw_drawn_video,   
        "-vcodec", "libx264",     # 🚀 ĐÃ ĐỔI: Encoder phần mềm chuẩn
        "-preset", "ultrafast",   # 🚀 ĐÃ ĐỔI: Chế độ nhanh nhất để đỡ tốn CPU
        "-crf", "28",             # Nén thêm một chút để file nhẹ, dễ load
        web_ready_video
    ]
    
    print("--- 🔄 Đang convert video sang chuẩn Web (CPU)... ---")
    subprocess.run(ffmpeg_cmd) 
    
    return {
        "id": unique_id,
        "video_url": f"http://localhost:8000/results/web_{safe_filename}",
        "filename": video.filename,
        "speed_limit": speed_limit,
        "timestamp": time.strftime("%H:%M:%S - %d/%m/%Y")
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)