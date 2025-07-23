// メインJavaScriptファイル

// Custom Alert System
function showCustomAlert(message, type = 'info', title = null) {
    // Remove any existing alerts
    const existingAlert = document.querySelector('.custom-alert-overlay');
    if (existingAlert) {
        existingAlert.remove();
    }

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-overlay';

    // Create alert container
    const alert = document.createElement('div');
    alert.className = `custom-alert ${type}`;

    // Set icon based on type
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    // Set title based on type if not provided
    const titles = {
        success: '成功',
        error: 'エラー',
        warning: '警告',
        info: '情報'
    };

    const finalTitle = title || titles[type];
    const icon = icons[type];

    // Create alert content
    alert.innerHTML = `
        <div class="custom-alert-header">
            <div class="custom-alert-icon">${icon}</div>
            <div class="custom-alert-title">${finalTitle}</div>
        </div>
        <div class="custom-alert-message">${message}</div>
        <div class="custom-alert-actions">
            <button class="btn btn-primary" onclick="closeCustomAlert()">OK</button>
        </div>
    `;

    // Add to DOM
    overlay.appendChild(alert);
    document.body.appendChild(overlay);

    // Add click outside to close
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeCustomAlert();
        }
    });

    // Add escape key to close
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeCustomAlert();
        }
    });
}

function closeCustomAlert() {
    const overlay = document.querySelector('.custom-alert-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
}

// Override the default alert function
window.originalAlert = window.alert;
window.alert = function(message) {
    // Determine type based on message content
    let type = 'info';
    if (message.includes('✅') || message.toLowerCase().includes('成功')) {
        type = 'success';
    } else if (message.includes('❌') || message.toLowerCase().includes('エラー')) {
        type = 'error';
    } else if (message.includes('⚠️') || message.toLowerCase().includes('警告')) {
        type = 'warning';
    }
    
    // Clean the message of emoji
    const cleanMessage = message.replace(/^[✅❌⚠️ℹ️]\s*/, '');
    showCustomAlert(cleanMessage, type);
};

// ページロード時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // トーストメッセージの自動非表示
    const toasts = document.querySelectorAll('.success-message, .error-message');
    toasts.forEach(toast => {
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 5000);
    });

    // フォームの送信時のローディング表示
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function() {
            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '送信中...';
            }
        });
    });

    // ナビゲーションのアクティブ状態管理
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
});

// ユーティリティ関数
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `${type}-message`;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.top = '100px';
    toast.style.right = '20px';
    toast.style.zIndex = '1000';
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

// エラーハンドリング
window.addEventListener('error', function(e) {
    console.error('JavaScript Error:', e.error);
});