const socket = io();

const requestsContainer = document.getElementById('requests-container');
const emptyRequestsMsg = document.getElementById('empty-requests-msg');
const pendingCount = document.getElementById('pending-count');
const queueContainer = document.getElementById('queue-container');
const queueCount = document.getElementById('queue-count');
const btnPlayNext = document.getElementById('btn-play-next');
const btnPlayPrev = document.getElementById('btn-play-prev');
const btnTogglePlay = document.getElementById('btn-toggle-play');
const autoplaySwitch = document.getElementById('autoplay-switch');
const btnIniciar = document.getElementById('btn-iniciar');
const delayContainer = document.getElementById('delay-container');
const delayInput = document.getElementById('autoplay-delay-input');
const delayMinus = document.getElementById('delay-minus');
const delayPlus = document.getElementById('delay-plus');
const lastSongSwitch = document.getElementById('last-song-switch');
const requestsSwitch = document.getElementById('requests-switch');

// Elementos de la Petición Manual
const btnManualAdd = document.getElementById('btn-manual-add');
const manualModal = document.getElementById('manual-modal');
const manualForm = document.getElementById('manual-form');
const btnManualCancel = document.getElementById('btn-manual-cancel');

// --- Firebase Authentication ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

const loginOverlay = document.getElementById('login-overlay');
const btnLogin = document.getElementById('btn-login');
const emailInput = document.getElementById('dj-email');
const passInput = document.getElementById('dj-pass');
const loginError = document.getElementById('login-error');
const togglePass = document.getElementById('toggle-pass');
const btnLogout = document.getElementById('btn-logout');
const logoutOverlay = document.getElementById('logout-loader-overlay');
const splashScreen = document.getElementById('splash-screen');

let isInitialLoad = true; // Bandera para evitar el toast al recargar

// Función para ocultar el Splash Screen suavemente
function hideSplash() {
  if (splashScreen) {
    splashScreen.style.opacity = '0';
    setTimeout(() => {
      splashScreen.style.visibility = 'hidden';
    }, 500);
  }
}

// Ocultar Splash Screen después de 1 segundo (Seguridad total)
setTimeout(() => {
  hideSplash();
}, 1000);

// Observador de estado de autenticación (Carga inicial y cambios)
auth.onAuthStateChanged((user) => {
  if (user) {
    document.body.style.overflow = 'auto'; // Habilitar scroll
    loginOverlay.style.opacity = '0';
    setTimeout(() => {
      loginOverlay.classList.add('hidden');
      logoutOverlay.classList.add('hidden');
      
      if (!isInitialLoad) {
        showToast(`Sesión activa: DJ de Puerto Chopp`, 'success');
      }
      isInitialLoad = false;
    }, 500);
  } else {
    document.body.style.overflow = 'hidden'; // Bloquear scroll
    loginOverlay.classList.remove('hidden');
    loginOverlay.style.opacity = '1';
    logoutOverlay.classList.add('hidden');
    
    // Resetear pedidos y UI por seguridad
    if (requestsSwitch) requestsSwitch.checked = false;
    isInitialLoad = false; 
    
    // Resetear botón e inputs
    btnLogin.disabled = false;
    btnLogin.innerHTML = 'Entrar <span class="material-symbols-rounded">login</span>';
    passInput.value = '';
    emailInput.value = '';
    loginError.classList.add('hidden');
  }
});

togglePass.addEventListener('click', () => {
  const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
  passInput.setAttribute('type', type);
  togglePass.querySelector('.material-symbols-rounded').textContent = type === 'password' ? 'visibility' : 'visibility_off';
  passInput.style.letterSpacing = type === 'password' ? '5px' : 'normal';
});

btnLogout.addEventListener('click', () => {
  // Desactivar pedidos automáticamente al salir
  socket.emit('set-requests-enabled', false);
  
  logoutOverlay.classList.remove('hidden');
  setTimeout(() => {
    auth.signOut().then(() => {
      showToast('Sesión cerrada', 'info');
    });
  }, 800); 
});

const btnResetQueue = document.getElementById('btn-reset-queue');

// Resetear cola con confirmación
btnResetQueue.addEventListener('click', () => {
  if (confirm('¿Estás seguro de que quieres vaciar TODA la cola? Esta acción no se puede deshacer.')) {
    socket.emit('reset-queue');
    showToast('Cola vaciada completamente', 'info');
  }
});

btnLogin.addEventListener('click', () => {
  const email = emailInput.value.trim();
  const pass = passInput.value;
  
  if(!email || !pass) {
    loginError.textContent = "Completá todos los campos";
    loginError.classList.remove('hidden');
    return;
  }

  // Activar estado de carga en el botón
  const originalContent = btnLogin.innerHTML;
  btnLogin.disabled = true;
  btnLogin.innerHTML = '<div class="loader-small"></div>';
  loginError.classList.add('hidden');

  auth.signInWithEmailAndPassword(email, pass).catch(err => {
    // Restaurar botón en caso de error
    btnLogin.disabled = false;
    btnLogin.innerHTML = originalContent;
    
    loginError.textContent = "Correo o contraseña incorrectos";
    loginError.classList.remove('hidden');
    console.error(err);
  });
});

passInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') btnLogin.click();
});
// ------------------------

let pendingRequests = new Map();
let queue = [];

// Renderizados
function renderRequests() {
  if (pendingRequests.size === 0) {
    requestsContainer.innerHTML = '';
    requestsContainer.appendChild(emptyRequestsMsg);
    emptyRequestsMsg.style.display = 'block';
  } else {
    emptyRequestsMsg.style.display = 'none';
    requestsContainer.innerHTML = '';
    
    const requestsArray = Array.from(pendingRequests.values());
    const req = requestsArray[0];
    const total = requestsArray.length;

    const card = document.createElement('div');
    card.id = `request-${req.id}`;
    card.className = 'request-card fade-in';
    card.innerHTML = `
      <div class="request-card-header" style="justify-content: center; flex-direction: column; text-align: center; gap: 0.2rem; margin-bottom: 0.5rem;">
        <strong style="font-size: 1rem;">Petición 1 de ${total}</strong>
        <span style="font-size: 0.8rem; color: var(--text-muted);">${new Date(req.timestamp).toLocaleTimeString()}</span>
      </div>
      <h3 style="margin-bottom: 0.4rem; color: var(--primary-color); text-align: center; font-size: 1.3rem;">${req.song}</h3>
      <p style="margin-bottom: 1rem; text-align: center; font-size: 1rem;">De: <strong>${req.clientName}</strong> <span class="badge" style="margin-left: 0.5rem; font-size: 0.75rem;">Mesa ${req.table}</span></p>
      
      <div style="margin-bottom: 1rem; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 12px;">
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.6rem;">
          <input type="text" id="yt-${req.id}" placeholder="Link de YouTube (Opcional)" style="margin-bottom: 0; padding: 0.7rem; font-size: 0.95rem; flex: 1;">
          <button class="btn-icon" style="width: 44px; height: 44px; border-radius: 10px;" onclick="previewYouTube('${req.id}')" title="Previsualizar video">
            <span class="material-symbols-rounded">visibility</span>
          </button>
        </div>
        <div style="display: flex; align-items: center; text-align: center; margin: 0.6rem 0;">
          <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.15);"></div>
          <span style="padding: 0 0.8rem; font-size: 0.65rem; color: var(--text-muted); font-weight: bold; text-transform: uppercase; letter-spacing: 1.2px; white-space: nowrap;">
            o Archivo Local
          </span>
          <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.15);"></div>
        </div>
        <input type="file" id="file-${req.id}" accept="video/*,audio/*" style="margin-bottom: 0; padding: 0.5rem; font-size: 0.9rem; width: 100%;">
      </div>
      
      <div style="display: flex; gap: 0.5rem;" id="action-buttons-${req.id}">
        <button class="btn" style="flex: 1; padding: 0.7rem; font-size: 1rem;" onclick="approveRequest('${req.id}')">Aprobar</button>
        <button class="btn btn-danger" style="flex: 1; padding: 0.7rem; font-size: 1rem;" onclick="showRejectInput('${req.id}')">Rechazar</button>
      </div>

      <div id="reject-container-${req.id}" class="hidden" style="margin-top: 0.8rem; border-top: 1px solid var(--glass-border); padding-top: 0.8rem;">
        <input type="text" id="reject-reason-${req.id}" placeholder="Motivo de rechazo" style="margin-bottom: 0.5rem; padding: 0.6rem; font-size: 0.9rem;">
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary" style="flex: 1; padding: 0.6rem; font-size: 0.9rem;" onclick="cancelReject('${req.id}')">Cancelar</button>
          <button class="btn btn-danger" style="flex: 1; padding: 0.6rem; font-size: 0.9rem;" onclick="confirmReject('${req.id}')">Confirmar</button>
        </div>
      </div>
    `;
    requestsContainer.appendChild(card);
  }
  pendingCount.textContent = pendingRequests.size;
}

function animateAndRemove(id, direction = 'right') {
  const card = document.getElementById(`request-${id}`);
  if (card) {
    card.classList.remove('fade-in');
    card.classList.add(direction === 'right' ? 'slide-out-right' : 'slide-out-left');
    setTimeout(() => {
      pendingRequests.delete(id);
      renderRequests();
    }, 400);
  } else {
    pendingRequests.delete(id);
    renderRequests();
  }
}

function renderQueue() {
  queueContainer.innerHTML = '';
  queue.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'queue-item fade-in';
    div.innerHTML = `
      <div class="rank">#${index + 1}</div>
      <div class="info" style="text-align: center; flex: 1;">
        <h4 style="margin:0; font-size: 1.1rem;">${item.song}</h4>
        <p style="margin:0; font-size: 0.9rem; opacity: 0.8;">${item.clientName} (Mesa ${item.table || '-'})</p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.4rem; align-items: flex-end;">
        <div class="badge" style="background: rgba(255,255,255,0.1); border: 1px solid var(--glass-border); font-size: 0.65rem;">${item.type === 'youtube' ? 'YT' : 'FILE'}</div>
        <button class="btn-danger" style="padding: 0.4rem; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; background: rgba(255, 51, 102, 0.15); border: 1px solid var(--primary-color); color: var(--primary-color);" onclick="removeFromQueue('${item.id}')" title="Eliminar de la cola">
          <span class="material-symbols-rounded" style="font-size: 1.2rem;">delete</span>
        </button>
      </div>
    `;
    queueContainer.appendChild(div);
  });
  queueCount.textContent = queue.length;
}

window.removeFromQueue = (id) => {
  socket.emit('remove-from-queue', id);
  showToast('Canción eliminada de la cola', 'info');
};

// Acciones
window.approveRequest = async (id) => {
  const ytInput = document.getElementById(`yt-${id}`).value.trim();
  const fileInput = document.getElementById(`file-${id}`).files[0];
  
  if (!ytInput && !fileInput) {
    showToast('Debes proveer un link de YouTube o un archivo.', 'error');
    return;
  }
  
  const req = pendingRequests.get(id);
  
  if (fileInput) {
    // Subir archivo
    const formData = new FormData();
    formData.append('file', fileInput);
    
    try {
      const btn = document.querySelector(`button[onclick="approveRequest('${id}')"]`);
      btn.textContent = 'Subiendo...';
      btn.disabled = true;
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      socket.emit('approve-request', {
        id,
        fileUrl: data.fileUrl,
        type: 'file',
        clientName: req.clientName
      });
      animateAndRemove(id, 'right');
    } catch (e) {
      console.error(e);
      showToast('Error al subir archivo', 'error');
      return;
    }
  } else {
    // Es YouTube
    if (!isValidYouTubeUrl(ytInput)) {
      showToast('El link de YouTube no parece ser válido.', 'error');
      return;
    }

    socket.emit('approve-request', {
      id,
      youtubeUrl: ytInput,
      type: 'youtube',
      clientName: req.clientName
    });
    animateAndRemove(id, 'right');
  }
};

window.showRejectInput = (id) => {
  document.getElementById(`action-buttons-${id}`).classList.add('hidden');
  document.getElementById(`reject-container-${id}`).classList.remove('hidden');
  document.getElementById(`reject-reason-${id}`).focus();
};

window.cancelReject = (id) => {
  document.getElementById(`reject-container-${id}`).classList.add('hidden');
  document.getElementById(`action-buttons-${id}`).classList.remove('hidden');
};

window.confirmReject = (id) => {
  const reason = document.getElementById(`reject-reason-${id}`).value.trim();
  socket.emit('reject-request', { id, reason: reason || 'Rechazado por el DJ' });
  animateAndRemove(id, 'left');
};

btnPlayNext.addEventListener('click', () => {
  socket.emit('play-next');
});

btnPlayPrev.addEventListener('click', () => {
  socket.emit('play-previous');
});

btnTogglePlay.addEventListener('click', () => {
  socket.emit('toggle-play');
});

btnIniciar.addEventListener('click', () => {
  socket.emit('toggle-karaoke');
});

// Funciones de UI
function updateKaraokeBtn(isRunning) {
  if (isRunning) {
    btnIniciar.innerHTML = '<span class="material-symbols-rounded">stop_circle</span> Parar Karaoke';
    btnIniciar.style.background = 'rgba(255, 51, 102, 0.2)';
    btnIniciar.style.borderColor = 'var(--primary-color)';
    btnIniciar.style.color = 'var(--primary-color)';
  } else {
    btnIniciar.innerHTML = '<span class="material-symbols-rounded">rocket_launch</span> Iniciar Karaoke';
    btnIniciar.style.background = 'rgba(255, 255, 255, 0.05)';
    btnIniciar.style.borderColor = 'var(--glass-border)';
    btnIniciar.style.color = 'var(--text-light)';
  }
}

function updatePlayNextBtn(autoplayOn) {
  btnPlayNext.disabled = autoplayOn;
  if (autoplayOn) {
    btnPlayNext.style.opacity = '0.3';
    btnPlayNext.style.cursor = 'not-allowed';
    delayContainer.style.opacity = '1';
    delayInput.disabled = false;
    delayMinus.disabled = false;
    delayPlus.disabled = false;
    delayMinus.style.cursor = 'pointer';
    delayPlus.style.cursor = 'pointer';
  } else {
    btnPlayNext.style.opacity = '1';
    btnPlayNext.style.cursor = 'pointer';
    delayContainer.style.opacity = '0.5';
    delayInput.disabled = true;
    delayMinus.disabled = true;
    delayPlus.disabled = true;
    delayMinus.style.cursor = 'not-allowed';
    delayPlus.style.cursor = 'not-allowed';
  }
}

// Autoplay
autoplaySwitch.addEventListener('change', (e) => {
  socket.emit('set-autoplay', e.target.checked);
  updatePlayNextBtn(e.target.checked);
});

delayInput.addEventListener('change', (e) => {
  let val = Number(e.target.value);
  if (val < 0) val = 0;
  socket.emit('set-autoplay-delay', val);
});

delayMinus.addEventListener('click', () => {
  if (delayInput.disabled) return;
  let val = Number(delayInput.value);
  val = val > 0 ? val - 1 : 0;
  delayInput.value = val;
  socket.emit('set-autoplay-delay', val);
});

delayPlus.addEventListener('click', () => {
  if (delayInput.disabled) return;
  let val = Number(delayInput.value);
  val = val < 60 ? val + 1 : 60;
  delayInput.value = val;
  socket.emit('set-autoplay-delay', val);
});

lastSongSwitch.addEventListener('change', (e) => {
  socket.emit('set-last-song', e.target.checked);
});

requestsSwitch.addEventListener('change', (e) => {
  socket.emit('set-requests-enabled', e.target.checked);
});

// Funciones Manuales
function capitalizeWords(str) {
  return str.replace(/\b[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+\b/g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

function isValidYouTubeUrl(url) {
  const regExp = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|.+\?v=)?([^&=%\?]{11})/;
  return regExp.test(url);
}

function extractVideoID(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

window.previewYouTube = (id) => {
  const url = document.getElementById(`yt-${id}`).value.trim();
  if (isValidYouTubeUrl(url)) {
    const videoId = extractVideoID(url);
    if (videoId) {
      const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
      document.getElementById('preview-iframe').src = embedUrl;
      document.getElementById('video-preview-modal').classList.remove('hidden');
    }
  } else {
    showToast('Ingresá un link de YouTube válido para previsualizar.', 'error');
  }
};

window.closePreviewModal = function() {
  document.getElementById('preview-iframe').src = '';
  document.getElementById('video-preview-modal').classList.add('hidden');
};

btnManualAdd.addEventListener('click', () => {
  manualModal.classList.add('active');
  document.getElementById('manual-client').focus();
});

btnManualCancel.addEventListener('click', () => {
  manualModal.classList.remove('active');
  manualForm.reset();
});

manualForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const clientName = capitalizeWords(document.getElementById('manual-client').value.trim());
  const songName = capitalizeWords(document.getElementById('manual-song').value.trim());
  const artistName = capitalizeWords(document.getElementById('manual-artist').value.trim());
  
  const fullSongName = artistName ? `${songName} - ${artistName}` : songName;
  
  socket.emit('new-request', {
    clientName,
    song: fullSongName,
    table: 'DJ' // Distintivo para peticiones manuales
  });
  
  manualModal.classList.remove('active');
  manualForm.reset();
});

// Socket Events
socket.on('initial-state', (state) => {
  state.pending.forEach(p => pendingRequests.set(p.id, p));
  queue = state.queue;
  autoplaySwitch.checked = state.autoplayEnabled;
  delayInput.value = state.autoplayDelay;
  lastSongSwitch.checked = state.lastSongMode;
  requestsSwitch.checked = state.requestsEnabled; // <--- Línea añadida
  updatePlayNextBtn(state.autoplayEnabled);
  updateKaraokeBtn(state.karaokeRunning);
  renderRequests();
  renderQueue();
});

socket.on('request-incoming', (req) => {
  pendingRequests.set(req.id, req);
  renderRequests();
});

socket.on('queue-updated', (data) => {
  queue = data.queue;
  renderQueue();
});

socket.on('autoplay-state', (state) => {
  autoplaySwitch.checked = state;
  updatePlayNextBtn(state);
});

socket.on('autoplay-delay-state', (delay) => {
  delayInput.value = delay;
});

socket.on('karaoke-running-state', (isRunning) => {
  updateKaraokeBtn(isRunning);
});

socket.on('last-song-state', (state) => {
  lastSongSwitch.checked = state;
});

socket.on('requests-enabled-state', (state) => {
  requestsSwitch.checked = state;
});

// Init
socket.emit('get-state');

// Notificaciones Toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'info';
  if (type === 'error') icon = 'error';
  if (type === 'success') icon = 'check_circle';

  toast.innerHTML = `
    <span class="material-symbols-rounded">${icon}</span>
    <div style="flex: 1;">${message}</div>
  `;
  
  container.appendChild(toast);
  
  // Auto-eliminar
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

socket.on('screen-error', (msg) => {
  showToast(`Error en Pantalla: ${msg}`, 'error');
});

socket.on('request-cancelled', (requestId) => {
  const card = document.getElementById(`request-${requestId}`);
  if (card) {
    card.classList.add('fade-out');
    setTimeout(() => {
      pendingRequests.delete(requestId);
      renderRequests();
    }, 300);
  }
});
