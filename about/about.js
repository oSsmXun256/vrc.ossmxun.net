document.addEventListener('DOMContentLoaded', function() {
    const contentContainer = document.getElementById('aboutContent');

    // about_data.json からデータを取得
    fetch('about_data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            renderAboutContent(data);
        })
        .catch(error => {
            console.error('Aboutデータの読み込みに失敗しました:', error);
            contentContainer.innerHTML = '<p class="aqua-text-white aqua-opacity-80">コンテンツの読み込み中にエラーが発生しました。</p>';
        });

    function renderAboutContent(data) {
        let html = '';

        // プロフィールセクション
        if (data.profile) {
            html += `
                <div class="aqua-mb-8 aqua-text-center">
                    <img alt="${data.profile.name}" 
                         class="aqua-w-32 aqua-h-32 aqua-rounded-2xl aqua-mx-auto aqua-shadow-lg aqua-mb-4" 
                         src="${data.profile.avatarImage}">
                    <h2 class="aqua-text-white aqua-text-2xl aqua-font-bold aqua-mb-2">${data.profile.name}</h2>
                    <p class="aqua-text-white aqua-opacity-90 aqua-mb-2">${data.profile.introduction}</p>
                    <p class="aqua-text-white aqua-opacity-70">${data.profile.description}</p>
                </div>
            `;
        }

        // 各セクション
        if (data.sections && data.sections.length > 0) {
            data.sections.forEach(section => {
                html += `
                    <div class="aqua-glass aqua-glass-light aqua-p-6 aqua-rounded-2xl aqua-mb-6">
                        <div class="aqua-flex aqua-items-center aqua-gap-3 aqua-mb-4">
                            <span class="aqua-icon-circle">${section.icon}</span>
                            <h3 class="aqua-text-white aqua-text-xl aqua-font-bold">${section.title}</h3>
                        </div>
                `;

                // content配列がある場合
                if (section.content && section.content.length > 0) {
                    html += '<div class="aqua-text-white aqua-opacity-80 aqua-space-y-2">';
                    section.content.forEach(text => {
                        html += `<p>${text}</p>`;
                    });
                    html += '</div>';
                }

                // items配列がある場合
                if (section.items && section.items.length > 0) {
                    html += '<div class="aqua-flex aqua-flex-wrap aqua-gap-2">';
                    section.items.forEach(item => {
                        html += `<span class="aqua-badge-glass">${item}</span>`;
                    });
                    html += '</div>';
                }

                // details配列がある場合
                if (section.details && section.details.length > 0) {
                    html += '<div class="aqua-grid aqua-grid-2">';
                    section.details.forEach(detail => {
                        html += `
                            <div class="aqua-stat-card">
                                <span class="aqua-text-white aqua-opacity-70 aqua-stat-label">${detail.label}</span>
                                <span class="aqua-text-white aqua-font-semibold">${detail.value}</span>
                            </div>
                        `;
                    });
                    html += '</div>';
                }

                // timeline配列がある場合
                if (section.timeline && section.timeline.length > 0) {
                    html += '<div class="aqua-space-y-3">';
                    section.timeline.forEach(entry => {
                        html += `
                            <div class="aqua-timeline-item aqua-flex aqua-gap-4 aqua-items-start">
                                <span class="aqua-badge-outline aqua-whitespace-nowrap">${entry.date}</span>
                                <span class="aqua-text-white aqua-opacity-90">${entry.event}</span>
                            </div>
                        `;
                    });
                    html += '</div>';
                }

                html += '</div>';
            });
        }

        // リンクセクション
        if (data.links && data.links.length > 0) {
            html += `
                <div class="aqua-glass aqua-glass-light aqua-p-6 aqua-rounded-2xl">
                    <h3 class="aqua-text-white aqua-text-xl aqua-font-bold aqua-mb-4">Links</h3>
                    <div class="aqua-grid aqua-grid-3">
            `;
            data.links.forEach(link => {
                html += `
                    <a href="${link.url}" target="_blank" rel="noopener noreferrer"
                       class="aqua-glass-pink-medium aqua-p-4 aqua-flex aqua-flex-col aqua-items-center aqua-gap-2 aqua-no-underline aqua-transition-transform aqua-duration-300 aqua-hover:scale-105 aqua-rounded-2xl link-card">
                        <img src="${link.icon}" alt="${link.name}" class="link-icon">
                        <span class="aqua-font-semibold aqua-text-sm link-label">${link.name}</span>
                    </a>
                `;
            });
            html += `
                    </div>
                </div>
            `;
        }

        contentContainer.innerHTML = html;
    }
});