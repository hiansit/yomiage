document.addEventListener('DOMContentLoaded', () => {
    const voiceSelect = document.getElementById('voice-select');
    const textInput = document.getElementById('text-input');
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    
    // Sliders
    const volumeSlider = document.getElementById('volume-slider');
    const rateSlider = document.getElementById('rate-slider');
    const volumeVal = document.getElementById('volume-val');
    const rateVal = document.getElementById('rate-val');

    volumeSlider.addEventListener('input', () => {
        volumeVal.textContent = Math.round(volumeSlider.value * 100);
    });

    rateSlider.addEventListener('input', () => {
        rateVal.textContent = Number(rateSlider.value);
    });

    // UI Elements for Status
    const statusText = document.getElementById('status-text');
    const progressText = document.getElementById('progress-text');

    let voices = [];
    const synth = window.speechSynthesis;

    // chunking state
    let textChunks = []; // Array of {text, start, end}
    let currentChunkIndex = 0;
    let isUserStopped = false;

    // UIステータスの更新関数
    function updateStatus(status, index = 0, total = 0) {
        if (status === 'playing') {
            statusText.textContent = '再生中';
            statusText.className = 'status-playing';
            progressText.textContent = `${index} / ${total}`;
        } else if (status === 'paused') {
            statusText.textContent = '一時停止中';
            statusText.className = 'status-paused';
        } else {
            statusText.textContent = '待機中';
            statusText.className = 'status-idle';
            progressText.textContent = `0 / 0`;
        }
    }

    // 長文を区切り文字で分割し、オフセット位置を記録する関数
    function extractChunks(text) {
        const parts = text.split(/([。．！？.!?\n]+)/);
        const chunks = [];
        let currentText = '';
        let currentIndex = 0;

        for(let i = 0; i < parts.length; i++) {
            currentText += parts[i];
            
            // 奇数番目が区切り、または最後の要素の場合にまとめる
            if (i % 2 !== 0 || i === parts.length - 1) {
                if (currentText.trim() !== '') {
                    // 空白を除去した正確な開始・終了位置を計算
                    const startOffset = currentText.length - currentText.trimStart().length;
                    const start = currentIndex + startOffset;
                    const cleanText = currentText.trim();
                    const end = start + cleanText.length;
                    
                    chunks.push({
                        text: cleanText,
                        start: start,
                        end: end
                    });
                }
                currentIndex += currentText.length;
                currentText = '';
            }
        }
        return chunks.length > 0 ? chunks : [{text: text.trim(), start: 0, end: text.length}];
    }

    // 音声リストの取得とセレクトボックスへの追加
    function populateVoiceList() {
        voices = synth.getVoices();
        voiceSelect.innerHTML = '';

        if (voices.length === 0) {
            const option = document.createElement('option');
            option.textContent = '音声が見つかりません';
            voiceSelect.appendChild(option);
            return;
        }

        voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            if (voice.default) {
                option.textContent += ' [Default]';
            }
            option.setAttribute('data-lang', voice.lang);
            option.setAttribute('data-name', voice.name);
            voiceSelect.appendChild(option);
        });

        // 優先的に日本語を選択
        const defaultIndex = voices.findIndex(v => v.lang === 'ja-JP');
        if (defaultIndex !== -1) {
            voiceSelect.selectedIndex = defaultIndex;
        }
    }

    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }
    
    populateVoiceList();

    // チャンクのリレー再生
    function playCurrentChunk() {
        if (currentChunkIndex >= textChunks.length || isUserStopped) {
            updateStatus('idle');
            return;
        }

        updateStatus('playing', currentChunkIndex + 1, textChunks.length);
        const chunk = textChunks[currentChunkIndex];
        const utterance = new SpeechSynthesisUtterance(chunk.text);
        
        // 音量と速度の適用
        utterance.volume = parseFloat(volumeSlider.value);
        utterance.rate = parseFloat(rateSlider.value);
        
        const selectedOption = voiceSelect.selectedOptions[0]?.getAttribute('data-name');
        const selectedVoice = voices.find(voice => voice.name === selectedOption);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onend = () => {
            if (isUserStopped) return;
            currentChunkIndex++;
            playCurrentChunk();
        };

        utterance.onerror = (e) => {
            console.warn('SpeechSynthesis Error: ', e);
            // キャンセルされたなどの場合はリレーを止める
            if (e.error !== 'interrupted' && e.error !== 'canceled' && !isUserStopped) {
                currentChunkIndex++;
                playCurrentChunk();
            }
        };

        // ハイライトの表示
        textInput.focus();
        textInput.setSelectionRange(chunk.start, chunk.end);

        synth.speak(utterance);
    }

    // 再生処理
    playBtn.addEventListener('click', () => {
        const textToRead = textInput.value;
        if (textToRead.trim() === '') {
            alert('読み上げるテキストを入力してください。');
            return;
        }

        // 既に再生中の場合はキャンセルして最初から
        isUserStopped = true;
        synth.cancel();

        // 少し時間をおいてから再スタート (キャンセル処理が非同期に波及する場合の安全策)
        setTimeout(() => {
            isUserStopped = false;
            textChunks = extractChunks(textToRead);
            currentChunkIndex = 0;
            playCurrentChunk();
        }, 100);
    });

    // 一時停止・再開処理
    pauseBtn.addEventListener('click', () => {
        if (synth.speaking && !synth.paused) {
            synth.pause();
            updateStatus('paused');
        } else if (synth.paused) {
            synth.resume();
            updateStatus('playing', currentChunkIndex + 1, textChunks.length);
        }
    });

    // 停止処理
    stopBtn.addEventListener('click', () => {
        isUserStopped = true;
        synth.cancel();
        updateStatus('idle');
    });
});
