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
  const sharePhoto = document.getElementById('sharePhoto');
  const zoomRange = document.getElementById('zoomRange');
  const zoomValue = document.getElementById('zoomValue');
  const zoomModeLabel = document.getElementById('zoomMode');
  const burnGuide = document.getElementById('burnGuide');
  let stream = null;
  let facingMode = 'environment';
  let guide = 'spiral';
  let rotation = 0;
  let photoUrl = null;
  let photoFile = null;
  let zoomMode = 'digital';
  let zoomFactor = 1;
  let zoomTrack = null;
  let zoomTimer = null;
  let zoomQueue = Promise.resolve();

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const formatZoom = value => `${value.toFixed(1)}×`;

  function useDigitalZoom(value = 1) {
    zoomMode = 'digital';
    zoomFactor = clamp(value, 1, 3);
    zoomRange.min = '1';
    zoomRange.max = '3';
    zoomRange.step = '0.1';
    zoomRange.value = String(zoomFactor);
    zoomValue.textContent = formatZoom(zoomFactor);
    zoomModeLabel.textContent = 'デジタル';
    video.style.transform = `scale(${zoomFactor})`;
  }

  function configureZoom(track) {
    zoomTrack = track;
    zoomQueue = Promise.resolve();
    let capabilities;
    let current;
    try {
      capabilities = track.getCapabilities?.().zoom;
      current = track.getSettings?.().zoom;
    } catch { /* Some browsers do not expose camera zoom. */ }
    if (Number.isFinite(capabilities?.min) && Number.isFinite(capabilities?.max) &&
        capabilities.min > 0 && capabilities.max > capabilities.min && Number.isFinite(current)) {
      zoomMode = 'camera';
      zoomFactor = clamp(current, capabilities.min, capabilities.max);
      zoomRange.min = String(capabilities.min);
      zoomRange.max = String(capabilities.max);
      zoomRange.step = String(capabilities.step > 0 ? capabilities.step : .1);
      zoomRange.value = String(zoomFactor);
      zoomValue.textContent = formatZoom(zoomFactor);
      zoomModeLabel.textContent = 'カメラ';
      video.style.transform = 'scale(1)';
    } else {
      useDigitalZoom();
    }
    zoomRange.disabled = false;
  }

  async function applyCameraZoom(track, requested) {
    if (track !== zoomTrack || zoomMode !== 'camera') return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: requested }] });
      if (track !== zoomTrack) return;
      const actual = track.getSettings?.().zoom;
      const tolerance = Math.max(.12, Number(zoomRange.step) * .55);
      if (!Number.isFinite(actual) || Math.abs(actual - requested) > tolerance) throw new Error('Zoom was not applied');
      zoomFactor = actual;
      zoomRange.value = String(actual);
      zoomValue.textContent = formatZoom(actual);
    } catch {
      if (track === zoomTrack) useDigitalZoom(requested);
    }
  }

  function requestZoom(value) {
    const requested = clamp(value, Number(zoomRange.min), Number(zoomRange.max));
    zoomValue.textContent = formatZoom(requested);
    if (zoomMode === 'digital') {
      useDigitalZoom(requested);
      return;
    }
    clearTimeout(zoomTimer);
    const track = zoomTrack;
    zoomTimer = setTimeout(() => {
      zoomQueue = zoomQueue.then(() => applyCameraZoom(track, requested));
    }, 120);
  }

  function drawGoldenSquares(ctx, width, height) {
    // Rotate the reference's 1:phi landscape rectangle into the portrait frame.
    // Its first (largest) square ends at the lower-right corner.
    const map = (u, v) => {
      let x = v * width;
      let y = height - u * (height / PHI);
      if (rotation === 1 || rotation === 2) x = width - x;
      if (rotation === 2 || rotation === 3) y = height - y;
      return { x, y };
    };
    const squares = [];
    const remaining = { x: 0, y: 0, width: PHI, height: 1 };
    for (let i = 0; i < 12; i++) {
      const side = Math.min(remaining.width, remaining.height);
      if (side * width < 5) break;
      let x = remaining.x;
      let y = remaining.y;
      if (i % 4 === 0) { remaining.x += side; remaining.width -= side; }
      else if (i % 4 === 1) { remaining.y += side; remaining.height -= side; }
      else if (i % 4 === 2) { x += remaining.width - side; remaining.width -= side; }
      else { y += remaining.height - side; remaining.height -= side; }
      squares.push({ x, y, side, direction: i % 4 });
    }

    ctx.strokeStyle = '#f5e9d2';
    ctx.globalAlpha = .7;
    ctx.lineWidth = Math.max(1, width / 480);
    ctx.shadowBlur = 3;
    for (const { x, y, side } of squares) {
      const corners = [map(x, y), map(x + side, y), map(x + side, y + side), map(x, y + side)];
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let j = 1; j < corners.length; j++) ctx.lineTo(corners[j].x, corners[j].y);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.strokeStyle = '#52b9ff';
    ctx.globalAlpha = .98;
    ctx.lineWidth = Math.max(2.3, width / 170);
    ctx.shadowBlur = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    let started = false;
    for (const { x, y, side, direction } of squares) {
      const centers = [
        { x: x + side, y: y + side },
        { x, y: y + side },
        { x, y },
        { x: x + side, y }
      ];
      const center = centers[direction];
      const startAngle = Math.PI + direction * Math.PI / 2;
      for (let j = 0; j <= 32; j++) {
        const angle = startAngle + j * Math.PI / 64;
        const point = map(center.x + side * Math.cos(angle), center.y + side * Math.sin(angle));
        if (!started) { ctx.moveTo(point.x, point.y); started = true; }
        else ctx.lineTo(point.x, point.y);
      }
    }
    ctx.stroke();
  }

  function drawGuide(ctx, width, height) {
    ctx.save();
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
      drawGoldenSquares(ctx, width, height);
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
    zoomRange.disabled = true;
    zoomModeLabel.textContent = '利用不可';
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showError('HTTPS のページを Safari で開いてください。');
      return;
    }
    startButton.disabled = true;
    status.textContent = '接続中';
    clearTimeout(zoomTimer);
    zoomTrack = null;
    captureButton.disabled = true;
    switchButton.disabled = true;
    zoomRange.disabled = true;
    zoomModeLabel.textContent = '準備中';
    zoomValue.textContent = '1.0×';
    video.style.transform = 'scale(1)';
    if (stream) stream.getTracks().forEach(track => track.stop());
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facingMode }, aspectRatio: { ideal: 1 / PHI }, width: { ideal: 1440 }, height: { ideal: 2330 } }
      });
      video.srcObject = stream;
      await video.play();
      cameraMessage.classList.add('hidden');
      status.textContent = facingMode === 'environment' ? '背面カメラ' : '前面カメラ';
      captureButton.disabled = false;
      switchButton.disabled = false;
      configureZoom(stream.getVideoTracks()[0]);
      redraw();
    } catch (error) {
      showError(error.name === 'NotAllowedError' ? 'Safari の設定でカメラを許可してから、もう一度お試しください。' : 'ほかのアプリがカメラを使用していないか確認してください。');
    } finally {
      startButton.disabled = false;
    }
  }

  function capture() {
    if (!video.videoWidth || !video.videoHeight) return;
    const aspect = 1 / PHI;
    const sourceAspect = video.videoWidth / video.videoHeight;
    let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
    if (sourceAspect > aspect) { sw = sh * aspect; sx = (video.videoWidth - sw) / 2; }
    else { sh = sw / aspect; sy = (video.videoHeight - sh) / 2; }
    const outputWidth = Math.round(sw);
    if (zoomMode === 'digital') {
      const cropWidth = sw / zoomFactor;
      const cropHeight = sh / zoomFactor;
      sx += (sw - cropWidth) / 2;
      sy += (sh - cropHeight) / 2;
      sw = cropWidth;
      sh = cropHeight;
    }
    const output = document.createElement('canvas');
    output.width = outputWidth;
    output.height = Math.round(output.width * PHI);
    const ctx = output.getContext('2d');
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, output.width, output.height);
    if (burnGuide.checked && guide !== 'none') {
      drawGuide(ctx, output.width, output.height);
    }
    output.toBlob(blob => {
      if (!blob) return;
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = URL.createObjectURL(blob);
      photoPreview.src = photoUrl;
      downloadPhoto.href = photoUrl;
      downloadPhoto.download = `phi_camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      photoFile = new File([blob], downloadPhoto.download, { type: 'image/jpeg' });
      sharePhoto.hidden = !navigator.canShare?.({ files: [photoFile] });
      photoDialog.showModal();
    }, 'image/jpeg', .92);
  }

  startButton.addEventListener('click', startCamera);
  captureButton.addEventListener('click', capture);
  zoomRange.addEventListener('input', () => requestZoom(Number(zoomRange.value)));
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
  sharePhoto.addEventListener('click', async () => {
    if (!photoFile) return;
    try { await navigator.share({ files: [photoFile], title: 'phi_camera' }); }
    catch (error) { if (error.name !== 'AbortError') status.textContent = '共有できませんでした'; }
  });
  window.addEventListener('resize', redraw);
  window.addEventListener('pagehide', () => { if (stream) stream.getTracks().forEach(track => track.stop()); });
  redraw();
})();
