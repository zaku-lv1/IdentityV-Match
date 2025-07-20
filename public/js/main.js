// メインJavaScriptファイル

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