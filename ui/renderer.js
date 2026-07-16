document.addEventListener('DOMContentLoaded', async () => {
    const inputs = {
        DISCORD_TOKEN: document.getElementById('DISCORD_TOKEN'),
        CHANNEL_IDS: document.getElementById('CHANNEL_IDS'),
        SERVER_IDS: document.getElementById('SERVER_IDS'),
        KEYWORDS_FILTER: document.getElementById('KEYWORDS_FILTER'),
        ALLOWED_USER_IDS: document.getElementById('ALLOWED_USER_IDS'),
        COOLDOWN_SECONDS: document.getElementById('COOLDOWN_SECONDS'),
        CHROME_PROFILE: document.getElementById('CHROME_PROFILE'),
        CHANNEL_NAMES_MAP: document.getElementById('CHANNEL_NAMES_MAP'),
        SAVED_SERVERS_MAP: document.getElementById('SAVED_SERVERS_MAP'),
        WEBHOOK_URL: document.getElementById('WEBHOOK_URL'),
        ANTI_KEYWORDS: document.getElementById('ANTI_KEYWORDS')
    };

    const checkboxes = {
        AUTO_START: document.getElementById('AUTO_START'),
        ENABLE_SOUND: document.getElementById('ENABLE_SOUND'),
        REQUIRE_IN_STOCK: document.getElementById('REQUIRE_IN_STOCK'),
        USE_INDEPENDENT_CHROME: document.getElementById('USE_INDEPENDENT_CHROME'),
        SUPER_SPEED_MODE: document.getElementById('SUPER_SPEED_MODE')
    };

    const btnSave = document.getElementById('btn-save');
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnOpenChrome = document.getElementById('btn-open-chrome');
    const btnKillChrome = document.getElementById('btn-kill-chrome');
    
    // Sidebar elements
    const selectSavedServer = document.getElementById('select-saved-server');
    const inputNewServer = document.getElementById('input-new-server');
    const btnAddServer = document.getElementById('btn-add-server');
    const btnFetchChannels = document.getElementById('btn-fetch-channels');
    const btnCheckAll = document.getElementById('btn-check-all');
    const btnUncheckAll = document.getElementById('btn-uncheck-all');
    const btnApplyChannels = document.getElementById('btn-apply-channels');
    const channelListContainer = document.getElementById('channel-list-container');

    const terminal = document.getElementById('log-output');
    const statusBadge = document.getElementById('status-badge');
    const toggleConfigBtn = document.getElementById('toggle-config');
    const configContent = document.getElementById('config-content');

    let isConfigVisible = true;

    toggleConfigBtn.addEventListener('click', () => {
        isConfigVisible = !isConfigVisible;
        if (isConfigVisible) {
            configContent.style.display = 'grid';
            toggleConfigBtn.textContent = '[-] Ẩn bớt';
        } else {
            configContent.style.display = 'none';
            toggleConfigBtn.textContent = '[+] Hiện cấu hình';
        }
    });

    // Hàm phát ra tiếng "Ting" bằng Web Audio API
    function playBeep() {
        if (!checkboxes.ENABLE_SOUND.checked) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.5, ctx.currentTime); // Âm lượng 50%
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) { console.error("Không thể phát âm thanh", e); }
    }

    // UI Logic for Channel Tags
    const inputNewChannel = document.getElementById('input-new-channel');
    const btnAddChannel = document.getElementById('btn-add-channel');
    const channelTagsContainer = document.getElementById('channel-tags-container');

    function renderChannelTags() {
        const currentIdsStr = inputs.CHANNEL_IDS.value;
        const currentIds = currentIdsStr ? currentIdsStr.split(',').map(id => id.trim()).filter(id => id) : [];
        let namesMap = {};
        try {
            if (inputs.CHANNEL_NAMES_MAP && inputs.CHANNEL_NAMES_MAP.value) {
                namesMap = JSON.parse(inputs.CHANNEL_NAMES_MAP.value);
            }
        } catch(e) {}
        
        channelTagsContainer.innerHTML = '';
        currentIds.forEach((id, index) => {
            const name = namesMap[id];
            const displayText = name ? `#${name} (${id})` : id;
            const div = document.createElement('div');
            div.className = 'tag-item';
            div.innerHTML = `
                <span>${displayText}</span>
                <span class="tag-remove" data-index="${index}" title="Xóa">✕</span>
            `;
            channelTagsContainer.appendChild(div);
        });

        // Add event listeners for remove buttons
        document.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                currentIds.splice(idx, 1);
                inputs.CHANNEL_IDS.value = currentIds.join(', ');
                renderChannelTags();
            });
        });
    }

    // UI Logic for Anti-Keyword Tags
    const inputNewAntiKeyword = document.getElementById('input-new-antikeyword');
    const btnAddAntiKeyword = document.getElementById('btn-add-antikeyword');
    const antiKeywordsTagsContainer = document.getElementById('anti-keywords-tags-container');

    function renderAntiKeywordTags() {
        if (!antiKeywordsTagsContainer) return;
        const currentStr = inputs.ANTI_KEYWORDS.value;
        const currentIds = currentStr ? currentStr.split(',').map(id => id.trim()).filter(id => id) : [];
        
        antiKeywordsTagsContainer.innerHTML = '';
        currentIds.forEach((id, index) => {
            const div = document.createElement('div');
            div.className = 'tag-item';
            div.innerHTML = `
                <span style="word-break: break-all;">${id}</span>
                <span class="tag-remove-ak" data-index="${index}" title="Xóa">✕</span>
            `;
            antiKeywordsTagsContainer.appendChild(div);
        });

        document.querySelectorAll('.tag-remove-ak').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                currentIds.splice(idx, 1);
                inputs.ANTI_KEYWORDS.value = currentIds.join(', ');
                renderAntiKeywordTags();
            });
        });
    }

    if (btnAddAntiKeyword) {
        btnAddAntiKeyword.addEventListener('click', () => {
            const newId = inputNewAntiKeyword.value.trim();
            if (!newId) return;

            const currentStr = inputs.ANTI_KEYWORDS.value;
            const currentIds = currentStr ? currentStr.split(',').map(id => id.trim()).filter(id => id) : [];
            
            if (!currentIds.includes(newId)) {
                currentIds.push(newId);
                inputs.ANTI_KEYWORDS.value = currentIds.join(', ');
                renderAntiKeywordTags();
            }
            inputNewAntiKeyword.value = '';
        });

        inputNewAntiKeyword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnAddAntiKeyword.click();
            }
        });
    }

    // UI Logic for Keyword Tags
    const inputNewKeyword = document.getElementById('input-new-keyword');
    const btnAddKeyword = document.getElementById('btn-add-keyword');
    const keywordsTagsContainer = document.getElementById('keywords-tags-container');

    function renderKeywordTags() {
        if (!keywordsTagsContainer) return;
        const currentStr = inputs.KEYWORDS_FILTER.value;
        const currentIds = currentStr ? currentStr.split(',').map(id => id.trim()).filter(id => id) : [];
        
        keywordsTagsContainer.innerHTML = '';
        currentIds.forEach((id, index) => {
            const div = document.createElement('div');
            div.className = 'tag-item';
            div.innerHTML = `
                <span style="word-break: break-all;">${id}</span>
                <span class="tag-remove-kw" data-index="${index}" title="Xóa">✕</span>
            `;
            keywordsTagsContainer.appendChild(div);
        });

        document.querySelectorAll('.tag-remove-kw').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                currentIds.splice(idx, 1);
                inputs.KEYWORDS_FILTER.value = currentIds.join(', ');
                renderKeywordTags();
            });
        });
    }

    if (btnAddKeyword) {
        btnAddKeyword.addEventListener('click', () => {
            const newId = inputNewKeyword.value.trim();
            if (!newId) return;

            const currentStr = inputs.KEYWORDS_FILTER.value;
            const currentIds = currentStr ? currentStr.split(',').map(id => id.trim()).filter(id => id) : [];
            
            if (!currentIds.includes(newId)) {
                currentIds.push(newId);
                inputs.KEYWORDS_FILTER.value = currentIds.join(', ');
                renderKeywordTags();
            }
            inputNewKeyword.value = '';
        });

        inputNewKeyword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnAddKeyword.click();
            }
        });
    }


    // Load config initially
    const config = await window.api.getConfig();
    for (const key in inputs) {
        if (config[key] !== undefined) inputs[key].value = config[key];
    }
    
    function renderSavedServers() {
        let serversMap = {};
        try {
            if (inputs.SAVED_SERVERS_MAP && inputs.SAVED_SERVERS_MAP.value) {
                serversMap = JSON.parse(inputs.SAVED_SERVERS_MAP.value);
            }
        } catch(e) {}
        
        const currentValue = selectSavedServer.value;
        selectSavedServer.innerHTML = '<option value="">-- Chọn Server --</option>';
        for (const [id, name] of Object.entries(serversMap)) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `${name} (${id})`;
            selectSavedServer.appendChild(opt);
        }
        if (serversMap[currentValue]) selectSavedServer.value = currentValue;
    }

    // Khởi tạo render UI cho tags
    renderChannelTags();
    renderAntiKeywordTags();
    renderKeywordTags();
    renderSavedServers();
    for (const key in checkboxes) {
        if (config[key] !== undefined) checkboxes[key].checked = (config[key] === 'true');
    }

    // Tự động load lại danh sách kênh đã fetch lần trước
    const savedChannelsData = localStorage.getItem('last_fetched_channels');
    if (savedChannelsData) {
        try {
            const { serverId, channels } = JSON.parse(savedChannelsData);
            renderChannelsList(channels, serverId);
            selectSavedServer.value = serverId;
        } catch(e) { console.error(e) }
    }

    function logToTerminal(text) {
        let colorClass = '';
        if (text.includes('Phát hiện link') || text.includes('Đã đăng nhập') || text.includes('Thành công') || text.includes('Tải xuống hoàn tất')) {
            colorClass = 'log-success';
        } else if (text.includes('Bỏ qua') || text.includes('⚠️') || text.includes('Spam') || text.includes('HẾT HÀNG') || text.includes('đóng ép')) {
            colorClass = 'log-warn';
        } else if (text.includes('Lỗi') || text.includes('❌') || text.includes('🚫') || text.includes('💀')) {
            colorClass = 'log-error';
        }
        
        let formatted = text.replace(/\n/g, '<br>');
        
        const match = formatted.match(/-> Đang mở:\s*(https?:\/\/[^\s<]+)/);
        if (match) {
            const url = match[1];
            formatted = formatted.replace(
                url, 
                `<span class="log-link-wrapper">${url} <button class="btn-inline-report" data-url="${url}" title="Chặn link này">🚫 Báo rác</button></span>`
            );
        }

        if (colorClass) {
            terminal.innerHTML += `<span class="${colorClass}">${formatted}</span>`;
        } else {
            terminal.innerHTML += formatted;
        }
        terminal.scrollTop = terminal.scrollHeight;
    }

    terminal.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-inline-report')) {
            const url = e.target.getAttribute('data-url');
            if (confirm(`Bạn có chắc chắn muốn chặn vĩnh viễn link này không?\n\nLink: ${url}`)) {
                let currentStr = inputs.ANTI_KEYWORDS.value;
                let currentIds = currentStr ? currentStr.split(',').map(id => id.trim()).filter(id => id) : [];
                if (!currentIds.includes(url)) {
                    currentIds.push(url);
                    inputs.ANTI_KEYWORDS.value = currentIds.join(', ');
                    if (typeof renderAntiKeywordTags === 'function') renderAntiKeywordTags();
                    await saveCurrentConfig(true);
                }
            }
        }
    });

    async function saveCurrentConfig(showOutput = false) {
        const newConfig = {};
        for (const key in inputs) newConfig[key] = inputs[key].value;
        for (const key in checkboxes) newConfig[key] = checkboxes[key].checked ? 'true' : 'false';
        await window.api.saveConfig(newConfig);
        if (showOutput) alert('Đã lưu cấu hình thành công!');
    }

    btnSave.addEventListener('click', async () => {
        await saveCurrentConfig(true);
    });

    btnStart.addEventListener('click', async () => {
        await saveCurrentConfig(false);
        terminal.innerHTML = '';
        if (isConfigVisible) toggleConfigBtn.click(); // Tự động ẩn cấu hình để lấy chỗ cho log
        window.api.startBot();
    });

    btnStop.addEventListener('click', () => {
        window.api.stopBot();
    });

    btnOpenChrome.addEventListener('click', async () => {
        await saveCurrentConfig(false); // Lưu profile lại trước khi mở
        window.api.openChromeDebug();
    });

    btnKillChrome.addEventListener('click', () => {
        if (confirm('LƯU Ý: Thao tác này sẽ ĐÓNG ÉP TOÀN BỘ Chrome đang mở trên máy tính (có thể làm mất dữ liệu web bạn đang dùng dở). Bạn có chắc chắn muốn tiếp tục không?')) {
            window.api.killChrome();
        }
    });

    // Sidebar Logic
    btnAddServer.addEventListener('click', () => {
        const newId = inputNewServer.value.trim();
        if (!newId) return;
        
        let serversMap = {};
        try {
            if (inputs.SAVED_SERVERS_MAP && inputs.SAVED_SERVERS_MAP.value) {
                serversMap = JSON.parse(inputs.SAVED_SERVERS_MAP.value);
            }
        } catch(e) {}
        
        if (!serversMap[newId]) {
            serversMap[newId] = "Server Chưa Rõ Tên";
            inputs.SAVED_SERVERS_MAP.value = JSON.stringify(serversMap);
            renderSavedServers();
            selectSavedServer.value = newId;
        }
        inputNewServer.value = '';
    });

    function renderChannelsList(channels, serverId) {
        channelListContainer.innerHTML = '';
        const currentIdsStr = inputs.CHANNEL_IDS.value;
        const currentIds = currentIdsStr ? currentIdsStr.split(',').map(id => id.trim()).filter(id => id) : [];

        channels.forEach(c => {
            const label = document.createElement('label');
            label.className = 'channel-item';
            const isChecked = currentIds.includes(c.id) ? 'checked' : '';
            label.innerHTML = `<input type="checkbox" class="channel-checkbox" value="${c.id}" data-name="${c.name}" ${isChecked}> #${c.name}`;
            channelListContainer.appendChild(label);
        });
    }

    btnFetchChannels.addEventListener('click', async () => {
        const token = inputs.DISCORD_TOKEN.value;
        const serverId = selectSavedServer.value;
        
        if (!token) return alert('Vui lòng nhập Discord Token ở cấu hình trước!');
        if (!serverId) return alert('Vui lòng chọn hoặc thêm ID Server!');

        channelListContainer.innerHTML = '<div style="text-align:center; margin-top:20px; color:#8e9297;">Đang tải...</div>';
        
        try {
            const response = await window.api.fetchChannels({ token, serverId });
            if (response.error) {
                channelListContainer.innerHTML = `<div style="text-align:center; margin-top:20px; color:#ed4245;">Lỗi: ${response.error}</div>`;
                return;
            }
            
            const channels = response.channels;
            if (channels.length === 0) {
                channelListContainer.innerHTML = `<div style="text-align:center; margin-top:20px; color:#8e9297;">Không tìm thấy kênh nào!</div>`;
                return;
            }

            // Cập nhật tên Server vào danh sách thả xuống
            let serversMap = {};
            try { if (inputs.SAVED_SERVERS_MAP && inputs.SAVED_SERVERS_MAP.value) serversMap = JSON.parse(inputs.SAVED_SERVERS_MAP.value); } catch(e){}
            serversMap[serverId] = response.serverName;
            inputs.SAVED_SERVERS_MAP.value = JSON.stringify(serversMap);
            renderSavedServers();
            selectSavedServer.value = serverId;

            // Lưu vào localStorage để mồi lại sau khi tắt app
            localStorage.setItem('last_fetched_channels', JSON.stringify({ serverId, channels }));

            renderChannelsList(channels, serverId);
        } catch (err) {
            channelListContainer.innerHTML = `<div style="text-align:center; margin-top:20px; color:#ed4245;">Lỗi: ${err.message}</div>`;
        }
    });

    btnCheckAll.addEventListener('click', () => {
        document.querySelectorAll('.channel-checkbox').forEach(cb => cb.checked = true);
    });

    btnUncheckAll.addEventListener('click', () => {
        document.querySelectorAll('.channel-checkbox').forEach(cb => cb.checked = false);
    });

    btnApplyChannels.addEventListener('click', () => {
        const checkedBoxes = document.querySelectorAll('.channel-checkbox:checked');
        if (checkedBoxes.length === 0) return alert('Bạn chưa chọn kênh nào!');

        let namesMap = {};
        try {
            if (inputs.CHANNEL_NAMES_MAP.value) {
                namesMap = JSON.parse(inputs.CHANNEL_NAMES_MAP.value);
            }
        } catch(e) {}

        const selectedIds = [];
        Array.from(checkedBoxes).forEach(cb => {
            selectedIds.push(cb.value);
            namesMap[cb.value] = cb.getAttribute('data-name');
        });
        
        inputs.CHANNEL_NAMES_MAP.value = JSON.stringify(namesMap);

        const currentIdsStr = inputs.CHANNEL_IDS.value;
        const currentIds = currentIdsStr ? currentIdsStr.split(',').map(id => id.trim()).filter(id => id) : [];
        
        // Thêm vào danh sách và loại bỏ trùng lặp
        const newIds = [...new Set([...currentIds, ...selectedIds])];
        inputs.CHANNEL_IDS.value = newIds.join(', ');
        
        renderChannelTags();
        
        alert(`Đã thêm ${selectedIds.length} kênh vào mục cấu hình. Hãy nhớ bấm "Lưu Cấu Hình" để áp dụng!`);
    });

    // (Channel tags render logic has been moved to the top)

    btnAddChannel.addEventListener('click', () => {
        const newId = inputNewChannel.value.trim();
        if (!newId) return;

        const currentIdsStr = inputs.CHANNEL_IDS.value;
        const currentIds = currentIdsStr ? currentIdsStr.split(',').map(id => id.trim()).filter(id => id) : [];
        
        if (!currentIds.includes(newId)) {
            currentIds.push(newId);
            inputs.CHANNEL_IDS.value = currentIds.join(', ');
            renderChannelTags();
        }
        inputNewChannel.value = '';
    });

    inputNewChannel.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnAddChannel.click();
        }
    });

    window.api.onBotLog((event, message) => {
        logToTerminal(message);
    });

    window.api.onPlaySound(() => {
        playBeep();
    });

    window.api.onBotStatus((event, status) => {
        if (status === 'running') {
            statusBadge.textContent = 'Trạng thái: Đang Chạy';
            statusBadge.className = 'badge running';
            btnStart.style.display = 'none';
            btnStop.style.display = 'block';
        } else {
            statusBadge.textContent = 'Trạng thái: Đang Tắt';
            statusBadge.className = 'badge stopped';
            btnStart.style.display = 'block';
            btnStop.style.display = 'none';
        }
    });

    window.api.onUpdateReady((event, version) => {
        const btnUpdate = document.getElementById('btn-update');
        if (btnUpdate) {
            btnUpdate.style.display = 'block';
            btnUpdate.textContent = `🎉 CẬP NHẬT LÊN v${version}`;
            btnUpdate.onclick = () => {
                if (confirm(`Bạn có chắc chắn muốn khởi động lại phần mềm để cập nhật lên phiên bản v${version} không?`)) {
                    window.api.installUpdate();
                }
            };
        }
    });
});
