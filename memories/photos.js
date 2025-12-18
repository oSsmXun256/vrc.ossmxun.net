document.addEventListener('DOMContentLoaded', function() {
    const photosContainer = document.querySelector('.photos');
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const closeBtn = document.querySelector('.close-btn');
    const loadingSpinner = document.querySelector('.loading-spinner');

    // 1. list.json から画像リストを取得
    fetch('list.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(imageUrls => {
            if (imageUrls.error) {
                console.error('Error from server:', imageUrls.error);
                photosContainer.innerHTML = '<p>写真の読み込みに失敗しました。</p>';
                return;
            }
            if (imageUrls.length === 0) {
                photosContainer.innerHTML = '<p>表示できる写真がありません。</p>';
                return;
            }

            // 2. 取得したパスの配列をループ処理
            imageUrls.forEach(url => {
                const photoBlock = document.createElement('div');
                photoBlock.className = 'photo-block modal';

                const imgElement = document.createElement('img');
                imgElement.src = url; // 例: ./photos/low/Low_VRChat_..._c.jpg
                imgElement.alt = '思い出の写真';
                imgElement.loading = 'lazy'; // パフォーマンス向上のため遅延読み込みを追加

                photoBlock.appendChild(imgElement);
                photosContainer.appendChild(photoBlock);

                // 3. クリック時の高画質画像への変換ロジック
                photoBlock.addEventListener('click', () => {
                    // パスの置換ルール:
                    // /low/Low_ -> /comp/ に変更
                    // _c.jpg -> .jpg に変更（存在する場合のみ）
                    const imgSrc = url
                        .replace('/low/Low_', '/comp/')
                        .replace('_c.jpg', '.jpg');

                    // モーダル表示処理
                    imageModal.style.display = 'flex';
                    loadingSpinner.style.display = 'block';
                    modalImage.style.display = 'none';

                    modalImage.onload = () => {
                        loadingSpinner.style.display = 'none';
                        modalImage.style.display = 'block';
                    };

                    modalImage.onerror = () => {
                        console.error('高画質画像の読み込みに失敗しました:', imgSrc);
                        loadingSpinner.style.display = 'none';
                        modalImage.style.display = 'block';
                    };
                    
                    modalImage.src = imgSrc;
                });
            });
        })
        .catch(error => {
            console.error('写真の読み込みに失敗しました:', error);
            photosContainer.innerHTML = '<p>写真の読み込み中にエラーが発生しました。</p>';
        });

    // モーダルを閉じる共通関数
    const closeModal = () => {
        imageModal.style.display = 'none';
        loadingSpinner.style.display = 'none';
        modalImage.style.display = 'none';
        modalImage.src = ''; 
    };

    closeBtn.addEventListener('click', closeModal);
    imageModal.addEventListener('click', (event) => {
        if (event.target === imageModal) closeModal();
    });
});