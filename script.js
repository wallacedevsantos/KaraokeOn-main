        // Referências aos elementos da interface
        const audioInputSelect = document.getElementById('audio-input-select');
        const startRecordingBtn = document.getElementById('start-recording');
        const stopRecordingBtn = document.getElementById('stop-recording');
        const waveformCanvas = document.getElementById('waveform-canvas');
        const timerDisplay = document.getElementById('timer-display'); // Contador

        // Inicializar variáveis
        let mediaStream = null;
        let mediaRecorder = null;
        let recordingInterval = null;
        let seconds = 0;
        let source = null; // Defina o source fora das funções
        let analyser = null; // Analyser para Web Audio API
        let audioContext = null; // Web Audio API Context
        let lowPass = null; // Filtro passa-baixa
        let reverb = null; // Reverberação
        let isRecording = false; // Variável para controlar se está gravando

        // Função para formatar o tempo no formato MM:SS
        function formatTime(seconds) {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        // Função para iniciar o contador
        function startTimer() {
            seconds = 0;
            timerDisplay.textContent = formatTime(seconds);
            recordingInterval = setInterval(() => {
                seconds++;
                timerDisplay.textContent = formatTime(seconds);
            }, 1000);
        }

        // Função para parar o contador
        function stopTimer() {
            clearInterval(recordingInterval);
        }

        // Função para renderizar o gráfico de onda (usando Web Audio API)
        function renderWaveform() {
            const canvasCtx = waveformCanvas.getContext('2d');
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            function draw() {
                if (analyser) { // Verifica se o analisador está definido
                    analyser.getByteTimeDomainData(dataArray);

                    canvasCtx.fillStyle = 'rgb(200, 200, 200)';
                    canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
                    canvasCtx.lineWidth = 2;
                    canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
                    canvasCtx.beginPath();

                    const sliceWidth = waveformCanvas.width / bufferLength;
                    let x = 0;

                    for (let i = 0; i < bufferLength; i++) {
                        const v = dataArray[i] / 128.0; // Normalizar entre 0 e 1
                        const y = (v * waveformCanvas.height) / 2; // Escalar para o canvas

                        if (i === 0) {
                            canvasCtx.moveTo(x, y);
                        } else {
                            canvasCtx.lineTo(x, y);
                        }

                        x += sliceWidth;
                    }

                    canvasCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
                    canvasCtx.stroke();
                }
                
                requestAnimationFrame(draw); // Loop para renderizar
            }

            draw();
        }

        // Função para listar dispositivos de entrada de áudio
        async function getAudioInputDevices() {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');

            audioInputs.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Microfone ${audioInputSelect.length + 1}`;
                audioInputSelect.appendChild(option);
            });
        }

        // Função para iniciar a gravação
        async function startRecording() {
            try {
                const deviceId = audioInputSelect.value; // Obter o ID do dispositivo selecionado
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        deviceId: { exact: deviceId },
                        // Não definindo taxa de amostragem ou codificação
                    }
                });

                // Criar uma nova instância de UserMedia para o Tone.js
                source = new Tone.UserMedia();
                await source.open();

                // Configurar o filtro passa-baixa
                lowPass = new Tone.Filter(1500, "lowpass").toDestination();
                source.connect(lowPass);

                // Configurar a reverberação
                reverb = new Tone.Reverb({
                    decay: 1.5,
                    preDelay: 0.01
                }).toDestination();
                lowPass.connect(reverb); // Conectar o filtro à reverberação

                // Conectar o microfone ao Tone.js para manipulação
                source.connect(Tone.Destination);

                // Configurar Web Audio API para visualizar a onda
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const input = audioContext.createMediaStreamSource(mediaStream);

                // Criar um analisador para visualização da onda
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 2048; // Aumentar a resolução
                input.connect(analyser); // Conectar a entrada do microfone ao analisador

                // Renderizar o gráfico de onda usando Web Audio API
                renderWaveform();

                // Criar uma nova instância de MediaRecorder
                mediaRecorder = new MediaRecorder(mediaStream);
                mediaRecorder.start();

                // Iniciar o timer
                startTimer();
                isRecording = true; // Marcar que a gravação está ativa

                // Desabilitar o botão de gravação e habilitar o botão de parar
                startRecordingBtn.disabled = true;
                stopRecordingBtn.disabled = false;

            } catch (error) {
                console.error('Erro ao iniciar a gravação de áudio:', error);
                // Tente conectar um microfone diferente, se houver erro
                stopRecording();
            }
        }

        // Função para parar a gravação
        function stopRecording() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                mediaStream.getTracks().forEach(track => track.stop());

                // Parar a reprodução do microfone e desconectar do Tone.js
                source.disconnect(Tone.Destination);
                source.close(); // Fechar a conexão de UserMedia para liberar o microfone

                // Fechar o contexto de áudio
                if (audioContext) {
                    audioContext.close();
                }

                stopTimer(); // Parar o timer
                isRecording = false; // Marcar que a gravação não está mais ativa
                startRecordingBtn.disabled = false;
                stopRecordingBtn.disabled = true;

                // Limpar o mediaStream, source, analyser, audioContext, lowPass e reverb
                mediaStream = null;
                source = null;
                analyser = null;
                audioContext = null;
                lowPass = null;
                reverb = null;
            }
        }

        // Inicializar os dispositivos de áudio ao carregar a página
        getAudioInputDevices();

        // Eventos dos botões de gravação
        startRecordingBtn.addEventListener('click', startRecording);
        stopRecordingBtn.addEventListener('click', stopRecording);