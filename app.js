(() => {
  const PHI = (1 + Math.sqrt(5)) / 2;
  const video = document.getElementById('video');
  const viewfinder = document.getElementById('viewfinder');
  const guideCanvas = document.getElementById('guideCanvas');
  const cameraMessage = document.getElementById('cameraMessage');
  const status = document.getElementById('status');
  const startButton = document.getElementById('startButton');
  const captureButton = document.getElementById('captureButton');
  const switchButton = document.getElementById('switchButton');
  const rotateButton = document.getElementById('rotateButton');
  const photoDialog = document.getElementById('photoDialog');
  const photoPreview = document.getElementById('photoPreview');
  const downloadPhoto = document.getElementById('downloadPhoto');
  let stream = null;
  let facingMode = 'environment';
  let guide = 'grid';
  let rotation = 0;
  let photoUrl = null;

  function drawGuide(ctx, width, height, pixelRatio = 1) {
    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);
    ctx.strokeStyle = '#f5ce89';
    ctx.fillStyle = '#f5ce89';
    ctx.lineWidth = Math.max(1.1, Math.min(width, height) / 450);
    ctx.shadowColor = '#000a';
    ctx.shadowBlur = 4;
    if (guide === 'grid') {
      const a = 1 / (PHI * PHI);
      ctx.globalAlpha = .83;
      [a, 1 - a].forEach(p => {
        ctx.beginPath(); ctx.moveTo(width * p, 0); ctx.lineTo(width * p, height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, height * p); ctx.lineTo(width, height * p); ctx.stroke();
      });
      [a, 1 - a].forEach(x => [a, 1 - a].forEach(y => {
        ctx.beginPath(); ctx.arc(width * x, height * y, 3, 0, Math.PI * 2); ctx.fill();
      }));
    } else if (guide === 'spiral') {
      // A logarithmic golden spiral: its radius grows by phi each quarter turn.
      const side = Math.min(width, height);
      const centerX = width * .382;
      const centerY = height * .382;
      const b = 2 * Math.log(PHI) / Math.PI;
      ctx.globalAlpha = .9;
      ctx.beginPath();
      for (let i = 0; i <= 320; i++) {
        const theta = -2 * Math.PI + i * 4 * Math.PI / 320;
        const radius = side * .027 * Math.exp(b * (theta + 2 * Math.PI));
        const angle = theta + rotation * Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(centerX, centerY, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function redraw() {
    const rect = viewfinder.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    guideCanvas.width = Math.round(rect.width * ratio);
    guideCanvas.height = Math.round(rect.height * ratio);
    guideCanvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
    drawGuide(guideCanvas.getContext('2d'), rect.width, rect.height);
  }

  function showError(message) {
    status.textContent = 'カメラ未接続';
    cameraMessage.classList.remove('hidden');
    cameraMessage.querySelector('h1').textContent = 'カメラを起動できません';
    cameraMessage.querySelector('p').textContent = message;
    startButton.textContent = 'もう一度試す';
    captureButton.disabled = true;
    switchButton.disabled = true;
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showError('HTTPS のページを Safari で開いてください。');
      return;
    }
    startButton.disabled = true;
    status.textContent = '接続中';
    if (stream) stream.getTracks().forEach(track => track.stop());
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      video.srcObject = stream;
      await video.play();
      cameraMessage.classList.add('hidden');
      status.textContent = facingMode === 'environment' ? '背面カメラ' : '前面カメラ';
      captureButton.disabled = false;
      switchButton.disabled = false;
      redraw();
    } catch (error) {
      showError(error.name === 'NotAllowedError' ? 'Safari の設定でカメラを許可してから、もう一度お試しください。' : 'ほかのアプリがカメラを使用していないか確認してください。');
    } finally {
      startButton.disabled = false;
    }
  }

  function capture() {
    if (!video.videoWidth || !video.videoHeight) return;
    const frame = viewfinder.getBoundingClientRect();
    const aspect = frame.width / frame.height;
    const sourceAspect = video.videoWidth / video.videoHeight;
    let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
    if (sourceAspect > aspect) { sw = sh * aspect; sx = (video.videoWidth - sw) / 2; }
    else { sh = sw / aspect; sy = (video.videoHeight - sh) / 2; }
    const output = document.createElement('canvas');
    output.width = Math.round(sw);
    output.height = Math.round(sh);
    const ctx = output.getContext('2d');
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, output.width, output.height);
    drawGuide(ctx, frame.width, frame.height, output.width / frame.width);
    output.toBlob(blob => {
      if (!blob) return;
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = URL.createObjectURL(blob);
      photoPreview.src = photoUrl;
      downloadPhoto.href = photoUrl;
      downloadPhoto.download = `phi-camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      photoDialog.showModal();
    }, 'image/jpeg', .92);
  }

  startButton.addEventListener('click', startCamera);
  captureButton.addEventListener('click', capture);
  switchButton.addEventListener('click', () => {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
  });
  rotateButton.addEventListener('click', () => { rotation = (rotation + 1) % 4; redraw(); });
  document.querySelectorAll('.guide-option').forEach(button => button.addEventListener('click', () => {
    guide = button.dataset.guide;
    document.querySelectorAll('.guide-option').forEach(option => {
      const active = option === button;
      option.classList.toggle('active', active);
      option.setAttribute('aria-pressed', String(active));
    });
    rotateButton.disabled = guide !== 'spiral';
    redraw();
  }));
  document.getElementById('helpButton').addEventListener('click', () => document.getElementById('helpDialog').showModal());
  document.getElementById('closeHelp').addEventListener('click', () => document.getElementById('helpDialog').close());
  document.getElementById('gotItButton').addEventListener('click', () => document.getElementById('helpDialog').close());
  document.getElementById('closePhoto').addEventListener('click', () => photoDialog.close());
  document.getElementById('retakeButton').addEventListener('click', () => photoDialog.close());
  window.addEventListener('resize', redraw);
  window.addEventListener('pagehide', () => { if (stream) stream.getTracks().forEach(track => track.stop()); });
  redraw();
})();
