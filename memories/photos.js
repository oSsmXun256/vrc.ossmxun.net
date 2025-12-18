document.addEventListener('DOMContentLoaded', function() {
    const photosContainer = document.querySelector('.photos');
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const closeBtn = document.querySelector('.close-btn');
    const loadingSpinner = document.querySelector('.loading-spinner'); // スピナーの要素を取得

    fetch('get_photos.php') // PHPスクリプトのパス
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(imageUrls => {
            if (imageUrls.error) {
                console.error('Error from server:', imageUrls.error);
                photosContainer.innerHTML = '<p>写真の読み込みに失敗しました。ディレクトリが見つからない可能性があります。</p>';
                return;
            }
            if (imageUrls.length === 0) {
                photosContainer.innerHTML = '<p>表示できる写真がありません。</p>';
                return;
            }
            console.log('写真の読み込みに成功:', imageUrls);
            imageUrls.forEach(url => {
                const photoBlock = document.createElement('div');
                photoBlock.className = 'photo-block modal'; // modalクラスを追加

                const imgElement = document.createElement('img');
                imgElement.src = url;
                imgElement.alt = '思い出の写真';

                photoBlock.appendChild(imgElement);
                photosContainer.appendChild(photoBlock);

                // 各photoBlockにクリックイベントリスナーを追加
                photoBlock.addEventListener('click', () => {
                    const imgSrc = imgElement.src.replace("/low/Low_","/comp/").replace("_c.jpg",".jpg");

                    // 1. モーダルを表示
                    imageModal.style.display = 'flex';
                    
                    // 2. スピナーを表示し、画像を非表示にする
                    loadingSpinner.style.display = 'block';
                    modalImage.style.display = 'none';

                    // 3. 画像の読み込みが完了した時の処理
                    modalImage.onload = () => {
                        loadingSpinner.style.display = 'none'; // スピナーを非表示
                        modalImage.style.display = 'block';   // 画像を表示
                    };

                    // 4. 画像の読み込みエラー時の処理
                    modalImage.onerror = () => {
                        console.error('モーダル画像の読み込みに失敗しました:', imgSrc);
                        loadingSpinner.style.display = 'none'; // エラーでもスピナーは非表示
                        modalImage.style.display = 'block'; // 画像を表示（壊れたアイコンが表示される）
                        // 必要であれば、エラーメッセージの表示など
                    };
                    
                    // 5. modalImageのsrcを設定（画像の読み込みが開始される）
                    modalImage.src = imgSrc;
                });
            });
        })
        .catch(error => {
            console.error('写真の読み込みに失敗しました:', error);
            photosContainer.innerHTML = '<p>写真の読み込み中にエラーが発生しました。</p>';
        });

    // モーダルを閉じる処理
    closeBtn.addEventListener('click', () => {
        imageModal.style.display = 'none';
        // モーダルを閉じる際に、スピナーと画像表示をリセット
        loadingSpinner.style.display = 'none';
        modalImage.style.display = 'none';
        modalImage.src = ''; // 次の表示のためにsrcをクリア
    });

    // モーダルの背景をクリックしても閉じる処理
    imageModal.addEventListener('click', (event) => {
        if (event.target === imageModal) { // modal-overlay自体のクリックかチェック
            imageModal.style.display = 'none';
            // モーダルを閉じる際に、スピナーと画像表示をリセット
            loadingSpinner.style.display = 'none';
            modalImage.style.display = 'none';
            modalImage.src = ''; // 次の表示のためにsrcをクリア
        }
    });
});