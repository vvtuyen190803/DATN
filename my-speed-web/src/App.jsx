import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Stage, Layer, Circle, Line, Image as KonvaImage } from 'react-konva';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';

// --- COMPONENT ĐĂNG NHẬP ---
const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post("http://localhost:8000/api/login", {
        username: username,
        password: password
      });

      if (response.data.status === "success") {
        localStorage.setItem('jwt_token', response.data.token);
        onLogin();
      }
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setError('Tài khoản hoặc mật khẩu không chính xác!');
      } else {
        setError('Không thể kết nối đến máy chủ AI!');
      }
    }
  };

  return (
    <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: '#cfd8dc', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <div className="card shadow-lg border-0 rounded-4" style={{ width: '100%', maxWidth: '450px', backgroundColor: '#eceff1' }}>
        <div className="card-body p-5">
          <div className="text-center mb-4">
            <div className="display-4 mb-3">🚦</div>
            <h3 className="fw-bold text-primary">AI TRAFFIC MONITOR</h3>
            <p className="text-muted fw-semibold">Hệ thống Quản trị & Giám sát</p>
          </div>
          
          <form onSubmit={handleLoginSubmit}>
            <div className="mb-3">
              <label className="fw-bold text-secondary mb-2">Tên đăng nhập</label>
              <input 
                type="text" 
                className="form-control form-control-lg border-0 shadow-sm" 
                placeholder="Nhập admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="mb-4">
              <label className="fw-bold text-secondary mb-2">Mật khẩu</label>
              <input 
                type="password" 
                className="form-control form-control-lg border-0 shadow-sm" 
                placeholder="Nhập admin123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            {error && (
              <div className="alert alert-danger fw-bold text-center py-2 mb-4" role="alert">
                {error}
              </div>
            )}
            
            <button type="submit" className="btn btn-primary btn-lg w-100 fw-bold shadow-sm">
              ĐĂNG NHẬP HỆ THỐNG
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT NAVIGATION ---
const Navigation = ({ onLogout }) => {
  const location = useLocation();
  return (
    <nav className="navbar navbar-expand-lg navbar-light mb-4 shadow-sm border-bottom" style={{ backgroundColor: '#eceff1' }}>
      <div className="container-fluid px-4">
        <span className="navbar-brand fw-bold text-primary fs-4">
          <span className="me-2">🚦</span>AI TRAFFIC MONITOR
        </span>
        <div className="collapse navbar-collapse d-flex justify-content-between">
          <ul className="navbar-nav mb-2 mb-lg-0 ms-4">
            <li className="nav-item me-3">
              <Link className={`nav-link fw-bold px-3 rounded ${location.pathname === '/' ? 'bg-primary text-white shadow-sm' : 'text-secondary hover-bg-light'}`} to="/">
                <span className="me-2">📹</span>GIÁM SÁT TRỰC TIẾP
              </Link>
            </li>
            <li className="nav-item">
              <Link className={`nav-link fw-bold px-3 rounded ${location.pathname === '/history' ? 'bg-primary text-white shadow-sm' : 'text-secondary hover-bg-light'}`} to="/history">
                <span className="me-2">📜</span>LỊCH SỬ PHẠT NGUỘI
              </Link>
            </li>
          </ul>
          <button className="btn btn-outline-danger fw-bold shadow-sm px-4" onClick={onLogout}>
            Đăng xuất 🚪
          </button>
        </div>
      </div>
    </nav>
  );
};

// --- COMPONENT CHÍNH ---
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('jwt_token'));
  const [videoFile, setVideoFile] = useState(null);
  const [bgImage, setBgImage] = useState(null);
  const [widthM, setWidthM] = useState(7);
  const [lengthM, setLengthM] = useState(25);
  
  const [originalVideoSize, setOriginalVideoSize] = useState({ width: 800, height: 500 });
  const [speedLimit, setSpeedLimit] = useState(60); 
  const [status, setStatus] = useState("");
  const [resultVideoUrl, setResultVideoUrl] = useState(null);
  const [points, setPoints] = useState([
    { x: 100, y: 450 }, { x: 250, y: 150 }, { x: 550, y: 150 }, { x: 700, y: 450 }, 
  ]);

  const [history, setHistory] = useState([]);
  const [violations, setViolations] = useState([]);
  const [selectedImg, setSelectedImg] = useState(null);

  // Lấy Token cho các request Axios
  const getAuthHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('jwt_token')}` }
  });

  const handleLogin = () => setIsAuthenticated(true);
  
  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    setIsAuthenticated(false);
  };

  const syncData = async () => {
    try {
      const [histRes, violRes] = await Promise.all([
        axios.get("http://localhost:8000/api/history", getAuthHeader()),
        axios.get("http://localhost:8000/api/violations", getAuthHeader())
      ]);
      setHistory(histRes.data);
      setViolations(violRes.data);
    } catch (err) { console.error("Lỗi đồng bộ dữ liệu"); }
  };

  useEffect(() => { 
    if (isAuthenticated) syncData(); 
  }, [isAuthenticated]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBgImage(null);          
    setResultVideoUrl(null);   
    setStatus("");             
    setVideoFile(file);        
    
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    
    video.muted = true;
    video.playsInline = true;
    video.autoplay = false;
    video.src = videoUrl;

    video.addEventListener('canplay', () => {
      setOriginalVideoSize({ width: video.videoWidth, height: video.videoHeight });
      video.currentTime = Math.min(0.5, video.duration / 2);
    }, { once: true });

    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800; 
      canvas.height = 500;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 800, 500);
      
      const img = new window.Image();
      img.onload = () => {
        setBgImage(img); 
        URL.revokeObjectURL(videoUrl); 
      };
      img.src = canvas.toDataURL('image/jpeg', 0.8);
    }, { once: true });
    
    video.onerror = () => console.error("Lỗi đọc file video.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile) return;
    setStatus("⏳ Hệ thống đang phân tích video, vui lòng đợi...");
    
    const scaledPoints = points.map(p => {
      const realX = Math.round((p.x / 800) * originalVideoSize.width);
      const realY = Math.round((p.y / 500) * originalVideoSize.height);
      return [realX, realY];
    });
    
    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("points", JSON.stringify(scaledPoints));
    formData.append("width_m", widthM);
    formData.append("length_m", lengthM);
    formData.append("speed_limit", speedLimit);

    try {
      const res = await axios.post("http://localhost:8000/api/analyze-speed", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        }
      });
      setResultVideoUrl(res.data.video_url);
      setStatus("✅ Xử lý thành công!");
      await syncData(); 
    } catch (err) { setStatus("❌ Lỗi kết nối tới Server AI!"); }
  };

  const handleClear = async () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử và ảnh vi phạm?")) {
      await axios.delete("http://localhost:8000/api/clear-all", getAuthHeader());
      setHistory([]);
      setViolations([]);
      setResultVideoUrl(null);
      setStatus("");
      setBgImage(null); 
      setVideoFile(null);
    }
  };

  const parseInfo = (name) => {
    const p = name.replace('.jpg', '').split('_');
    return { id: p[1] || '?', v: p[2] || '?' };
  };

  if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} />;

  return (
    <Router>
      <style>{`
        .custom-slider { -webkit-appearance: none; width: 100%; height: 18px; border: 2px solid #b0bec5; border-radius: 10px; outline: none; transition: background 0.1s ease-in-out; }
        .custom-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 24px; height: 24px; border-radius: 50%; background: #ffffff; border: 3px solid #0d6efd; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.3); transition: transform 0.1s; }
        .custom-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
      `}</style>

      <div className="container-fluid min-vh-100 p-0 pb-5" style={{ backgroundColor: '#cfd8dc', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <Navigation onLogout={handleLogout} />
        <div className="container-fluid px-4">
          <Routes>
            <Route path="/" element={
              <div className="row g-4">
                <div className="col-lg-4">
                  <div className="card shadow border-0 mb-4 rounded-3" style={{ backgroundColor: '#eceff1' }}>
                    <div className="card-header border-bottom pt-4 pb-3" style={{ backgroundColor: '#eceff1' }}>
                      <h5 className="fw-bold text-dark mb-0">⚙️ Thiết lập Phân tích</h5>
                    </div>
                    <div className="card-body p-4">
                      <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                          <label className="fw-semibold text-secondary mb-2">1. Chọn Video giao thông</label>
                          <input type="file" className="form-control form-control-lg border-0 shadow-sm" style={{ backgroundColor: '#ffffff' }} onChange={handleFileChange} accept="video/mp4,video/x-m4v,video/*" />
                        </div>

                        <div className="row g-3 mb-4">
                          <div className="col-6">
                            <label className="fw-semibold text-secondary mb-2">📏 Chiều rộng W_m (m)</label>
                            <input type="number" className="form-control form-control-lg border-0 shadow-sm" style={{ backgroundColor: '#ffffff' }} value={widthM} onChange={(e) => setWidthM(e.target.value)} min="1" step="0.5" />
                          </div>
                          <div className="col-6">
                            <label className="fw-semibold text-secondary mb-2">📏 Chiều dài L_m (m)</label>
                            <input type="number" className="form-control form-control-lg border-0 shadow-sm" style={{ backgroundColor: '#ffffff' }} value={lengthM} onChange={(e) => setLengthM(e.target.value)} min="1" step="0.5" />
                          </div>
                        </div>
                        
                        <div className="mb-4 p-4 border border-secondary border-opacity-25 rounded-3 shadow-sm" style={{ backgroundColor: '#ffffff' }}>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <label className="fw-bold text-dark fs-6 mb-0">⚡ Ngưỡng vi phạm:</label>
                            <span className="badge bg-danger fs-5 px-3 py-2 rounded-pill shadow-sm">{speedLimit} km/h</span>
                          </div>
                          <input type="range" className="custom-slider" min="0" max="100" value={speedLimit} onChange={(e)=>setSpeedLimit(e.target.value)} style={{ background: `linear-gradient(to right, #0d6efd ${speedLimit}%, transparent ${speedLimit}%)` }} />
                          <div className="d-flex justify-content-between text-muted small mt-2 fw-semibold">
                            <span>0 km/h</span><span>100 km/h</span>
                          </div>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg w-100 fw-bold shadow-sm" disabled={!videoFile}>
                          🚀 BẮT ĐẦU PHÂN TÍCH
                        </button>
                      </form>
                      {status && (
                        <div className={`mt-4 text-center fw-bold p-3 rounded-3 border ${status.includes('✅') ? 'bg-success text-white border-success' : status.includes('❌') ? 'bg-danger text-white border-danger' : 'bg-warning text-dark border-warning'}`}>
                          {status}
                        </div>
                      )}
                    </div>
                  </div>
                  {resultVideoUrl && (
                    <div className="card shadow border-0 rounded-3 overflow-hidden">
                       <div className="card-header bg-primary text-white py-3 border-0"><h6 className="fw-bold mb-0 text-center">🎬 Video Theo Dõi Tốc Độ</h6></div>
                       <div className="card-body p-0" style={{ backgroundColor: '#eceff1' }}><video src={resultVideoUrl} controls autoPlay className="w-100" style={{ display: 'block' }}/></div>
                    </div>
                  )}
                </div>

                <div className="col-lg-8">
                  <div className="card shadow border-0 rounded-3 h-100" style={{ backgroundColor: '#eceff1' }}>
                     <div className="card-header border-bottom pt-4 pb-3 d-flex justify-content-between align-items-center" style={{ backgroundColor: '#eceff1' }}>
                        <h5 className="fw-bold text-dark mb-0">🎯 Khu vực đo tốc độ (ROI)</h5>
                        <span className="badge bg-info text-dark rounded-pill px-3 py-2 shadow-sm">Kéo các chấm xanh để khớp mặt đường</span>
                     </div>
                     <div className="card-body d-flex justify-content-center align-items-center" style={{ minHeight: '550px' }}>
                        <div className="position-relative overflow-hidden shadow-sm" style={{ width: '800px', height: '500px', backgroundColor: '#cfd8dc', border: bgImage ? '3px solid #0d6efd' : '3px dashed #90a4ae', borderRadius: '12px' }}>
                          {!bgImage && (
                            <div className="position-absolute w-100 h-100 d-flex flex-column align-items-center justify-content-center text-secondary">
                              <span style={{ fontSize: '4rem' }}>📷</span><h5 className="mt-3 fw-bold text-dark opacity-75">Chưa có dữ liệu hình ảnh</h5><p className="text-muted fw-semibold">Vui lòng chọn video ở khung bên trái để bắt đầu vẽ ROI</p>
                            </div>
                          )}
                          <Stage width={800} height={500} className="position-absolute top-0 start-0">
                            <Layer>
                              {bgImage && <KonvaImage image={bgImage} width={800} height={500} opacity={0.85} />}
                              {bgImage && (
                                <>
                                  <Line points={points.flatMap(p => [p.x, p.y])} stroke="#0d6efd" strokeWidth={3} closed fill="rgba(13, 110, 253, 0.2)" />
                                  {points.map((p, i) => (
                                    <Circle 
                                      key={i} x={p.x} y={p.y} radius={8} fill="#ffffff" stroke="#0d6efd" strokeWidth={4} draggable 
                                      onDragMove={(e) => {
                                        const newX = e.target.x(); const newY = e.target.y(); const newPoints = [...points];
                                        newPoints[i] = { x: newX, y: newY };
                                        if (i === 0) newPoints[3].y = newY; if (i === 3) newPoints[0].y = newY;
                                        if (i === 1) newPoints[2].y = newY; if (i === 2) newPoints[1].y = newY;
                                        setPoints(newPoints);
                                      }}
                                      onMouseEnter={(e) => { e.target.getStage().container().style.cursor = 'grab'; }}
                                      onMouseLeave={(e) => { e.target.getStage().container().style.cursor = 'default'; }}
                                    />
                                  ))}
                                </>
                              )}
                            </Layer>
                          </Stage>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            } />

            <Route path="/history" element={
              <div className="row g-4">
                <div className="col-12">
                  <div className="d-flex justify-content-between align-items-center p-4 rounded-3 shadow border-0" style={{ backgroundColor: '#eceff1' }}>
                    <h4 className="fw-bold text-danger mb-0">🛡️ KHO DỮ LIỆU PHẠT NGUỘI</h4>
                    <div>
                       <button className="btn btn-outline-primary fw-bold me-3 shadow-sm px-4" onClick={syncData}>🔄 Làm Mới</button>
                       <button className="btn btn-danger fw-bold shadow-sm px-4" onClick={handleClear}>🗑️ Xóa Lịch Sử</button>
                    </div>
                  </div>
                </div>

                <div className="col-lg-4">
                  <div className="card shadow border-0 h-100 rounded-3">
                    <div className="card-header bg-primary text-white fw-bold py-3 border-0">📑 Phiên Phân Tích</div>
                    <div className="card-body p-0 table-responsive" style={{maxHeight: '600px', backgroundColor: '#eceff1'}}>
                      <table className="table table-hover align-middle mb-0">
                        <thead style={{ backgroundColor: '#cfd8dc' }}>
                          <tr><th className="px-3 border-0">Thời gian</th><th className="border-0">Tên Video</th><th className="border-0">Ngưỡng</th></tr>
                        </thead>
                        <tbody>
                          {history.length === 0 ? (
                            <tr><td colSpan="3" className="text-center text-muted py-5 border-0">Chưa có dữ liệu</td></tr>
                          ) : (
                            history.map((h, i) => (
                              <tr key={i}>
                                <td className="small px-3 text-muted fw-semibold">{h.timestamp}</td>
                                <td className="fw-bold small text-truncate text-dark" style={{maxWidth: '120px'}} title={h.filename}>{h.filename}</td>
                                <td className="text-danger fw-bold">{h.speed_limit} km/h</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="col-lg-8">
                  <div className="card shadow border-0 h-100 rounded-3" style={{ backgroundColor: '#eceff1' }}>
                     <div className="card-header border-bottom fw-bold py-3 d-flex justify-content-between align-items-center" style={{ backgroundColor: '#eceff1' }}>
                        <span className="text-dark">📸 Bằng Chứng Auto-Crop</span>
                        <span className="badge bg-danger rounded-pill px-3 shadow-sm">{violations.length} Vi phạm</span>
                     </div>
                     <div className="card-body">
                        <div className="row row-cols-2 row-cols-md-4 g-4">
                          {violations.length === 0 ? (
                            <div className="col-12 text-center text-muted py-5 w-100">
                              <h1 className="display-1 text-secondary opacity-25 mb-3">🚗</h1><p className="fw-semibold">Không có phương tiện vi phạm nào trong hệ thống.</p>
                            </div>
                          ) : (
                            violations.map((img, i) => {
                              const info = parseInfo(img.filename);
                              return (
                                <div className="col" key={i} onClick={() => setSelectedImg(img)}>
                                  <div className="card h-100 border-0 shadow-sm rounded-3 overflow-hidden" style={{cursor: 'pointer', transition: 'transform 0.2s', backgroundColor: '#ffffff'}}>
                                    <div className="position-relative">
                                      <img src={img.url} className="card-img-top" style={{height: '140px', objectFit: 'cover'}} alt="Vi phạm" />
                                      <span className="position-absolute bottom-0 start-0 w-100 bg-danger text-white text-center fw-bold py-1 opacity-75">{info.v}</span>
                                    </div>
                                    <div className="card-body p-2 text-center bg-white border-top">
                                      <small className="text-muted fw-bold d-block">ID Định Danh: <span className="text-dark">{info.id}</span></small>
                                    </div>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            } />
          </Routes>
        </div>

        {selectedImg && (
          <div className="modal d-block" style={{backgroundColor: 'rgba(207, 216, 220, 0.95)', zIndex: 1050, backdropFilter: 'blur(5px)'}} onClick={() => setSelectedImg(null)}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content bg-transparent border-0 text-center shadow-none">
                <div className="position-relative d-inline-block mx-auto">
                   <img src={selectedImg.url} className="img-fluid rounded-3 border border-4 border-danger shadow-lg mb-4" alt="Zoomed" style={{ maxHeight: '60vh' }} />
                   <button className="btn btn-dark rounded-circle position-absolute top-0 end-0 m-3 shadow" style={{ width: '40px', height: '40px' }} onClick={(e) => {e.stopPropagation(); setSelectedImg(null);}}>✖</button>
                </div>
                <div>
                  <h3 className="text-danger fw-bold bg-white d-inline-block px-5 py-3 rounded-pill shadow border border-danger">
                    🚗 ID: {parseInfo(selectedImg.filename).id} &nbsp;|&nbsp; ⚡ {parseInfo(selectedImg.filename).v}
                  </h3>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;