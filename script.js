// ==UserScript==
// @name         Kahoot Quiz Info Display with AI Integration
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  Display detailed Kahoot quiz information with user-customizable, movable, and minimizable display options and AI answers
// @author       You
// @match        *://*.kahoot.it/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const model = 'gemini-2.0-flash';
    const apiKey = '';
    const apiUrl = 'https://api.henryni.cn/v1/chat/completions';

    let quizData = {
        currentQuestion: '',
        currentChoices: [],
        imageUrl: '',
        imageMetadata: { id: '', contentType: '', width: 0, height: 0 },
        videoUrl: '',
        videoService: '',
        layout: '',
        questionIndex: 0,
        totalQuestions: 0,
        timeAvailable: 0,
        numberOfAnswersAllowed: 0,
        numberOfChoices: 0,
        pointsMultiplier: 1,
        getReadyTime: 0
    };

    let lastQuestion = '';
    let lastChoices = [];
    let currentAnswer = 'Waiting for AI answer...';

    function createDraggableElement(id, initialTop, initialLeft, isMenu = false) {
        let div = document.createElement('div');
        div.id = id;
        div.style.position = 'fixed';
        div.style.top = initialTop;
        div.style.left = initialLeft;
        div.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        div.style.color = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.zIndex = '9999';
        div.style.fontFamily = 'Arial, sans-serif';
        div.style.fontSize = '14px';
        div.style.maxWidth = '450px';
        div.style.maxHeight = '80vh';
        div.style.overflow = 'auto';
        div.style.userSelect = 'none'; // 防止文本选中干扰拖动

        // 添加标题栏和最小化按钮
        let header = document.createElement('div');
        header.style.cursor = 'move';
        header.style.padding = '5px';
        header.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        header.style.borderBottom = '1px solid white';
        header.innerHTML = isMenu ? '<strong>Menu</strong>' : '<strong>Quiz Info</strong>';

        let minimizeBtn = document.createElement('button');
        minimizeBtn.innerText = '−';
        minimizeBtn.style.float = 'right';
        minimizeBtn.style.background = 'none';
        minimizeBtn.style.border = 'none';
        minimizeBtn.style.color = 'white';
        minimizeBtn.style.cursor = 'pointer';
        header.appendChild(minimizeBtn);

        div.appendChild(header);
        let content = document.createElement('div');
        content.id = `${id}Content`;
        div.appendChild(content);

        document.body.appendChild(div);

        // 拖动功能
        let isDragging = false;
        let currentX, currentY;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            currentX = e.clientX - parseInt(div.style.left);
            currentY = e.clientY - parseInt(div.style.top);
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                div.style.left = `${e.clientX - currentX}px`;
                div.style.top = `${e.clientY - currentY}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // 最小化功能
        let isMinimized = false;
        minimizeBtn.addEventListener('click', () => {
            isMinimized = !isMinimized;
            content.style.display = isMinimized ? 'none' : 'block';
            minimizeBtn.innerText = isMinimized ? '+' : '−';
            div.style.maxHeight = isMinimized ? 'auto' : '80vh';
        });

        return content;
    }

    function createMenu() {
        let menuContent = createDraggableElement('quizMenu', '10px', 'calc(100% - 210px)', true);
        menuContent.innerHTML = `
            <strong>Display Options:</strong><br>
            <label><input type="checkbox" id="showImage" checked> Show Image</label><br>
            <label><input type="checkbox" id="showVideo" checked> Show Video</label><br>
            <label><input type="checkbox" id="showLayout" checked> Show Layout</label><br>
            <label><input type="checkbox" id="showTime" checked> Show Time Available</label><br>
            <label><input type="checkbox" id="showAnswersAllowed" checked> Show Answers Allowed</label><br>
            <label><input type="checkbox" id="showChoicesCount" checked> Show Choices Count</label><br>
            <label><input type="checkbox" id="showPointsMultiplier" checked> Show Points Multiplier</label><br>
            <label><input type="checkbox" id="showPrepTime" checked> Show Prep Time</label><br>
        `;

        ['showImage', 'showVideo', 'showLayout', 'showTime', 'showAnswersAllowed', 'showChoicesCount', 'showPointsMultiplier', 'showPrepTime'].forEach(id => {
            let checkbox = document.getElementById(id);
            checkbox.checked = localStorage.getItem(id) !== 'false'; // 默认显示
            checkbox.addEventListener('change', () => {
                localStorage.setItem(id, checkbox.checked);
                updateDisplayBox(quizData, currentAnswer);
            });
        });
    }

    function updateDisplayBox(data, answer = 'Waiting for AI answer...') {
        let displayContent = document.getElementById('quizInfoBoxContent') || createDraggableElement('quizInfoBox', '10px', '10px');
        if (!data.currentQuestion || data.currentChoices.length === 0) {
            displayContent.innerHTML = '<strong>Invalid or incomplete data received.</strong>';
            return;
        }
        let choicesText = data.currentChoices.join(' | ');
        let html = `<strong>Question ${data.questionIndex + 1}/${data.totalQuestions}:</strong> ${data.currentQuestion}<br><strong>Choices:</strong> ${choicesText}<br>`;

        if (document.getElementById('showImage')?.checked && data.imageUrl) {
            html += `<img src="${data.imageUrl}" style="max-width:100%;height:auto;" /><br>Image: ${data.imageMetadata.contentType}, ${data.imageMetadata.width}x${data.imageMetadata.height}<br>`;
        }
        if (document.getElementById('showVideo')?.checked && data.videoUrl) {
            html += `Video: <a href="${data.videoUrl}" target="_blank">${data.videoService} Link</a><br>`;
        }
        if (document.getElementById('showLayout')?.checked) {
            html += `<strong>Layout:</strong> ${data.layout}<br>`;
        }
        if (document.getElementById('showTime')?.checked) {
            html += `<strong>Time Available:</strong> ${data.timeAvailable / 1000} seconds<br>`;
        }
        if (document.getElementById('showAnswersAllowed')?.checked) {
            html += `<strong>Answers Allowed:</strong> ${data.numberOfAnswersAllowed}<br>`;
        }
        if (document.getElementById('showChoicesCount')?.checked) {
            html += `<strong>Choices Count:</strong> ${data.numberOfChoices}<br>`;
        }
        if (document.getElementById('showPointsMultiplier')?.checked) {
            html += `<strong>Points Multiplier:</strong> ${data.pointsMultiplier}x<br>`;
        }
        if (document.getElementById('showPrepTime')?.checked) {
            html += `<strong>Prep Time:</strong> ${data.getReadyTime / 1000} seconds<br>`;
        }
        html += `<strong>AI Answer:</strong> ${answer}`;

        displayContent.innerHTML = html;
    }

    async function getAIAnswer(question, choices, answersAllowed) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: `你是一个回答问题的 AI。选项从左到右的顺序分别是 1，2，3，4。此题允许选择 ${answersAllowed} 个答案。请按照以下格式回答：选项名字/数字` },
                        { role: 'user', content: `Question: ${question}\nChoices: ${choices.join(', ')}` }
                    ]
                })
            });
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Failed to fetch AI answer:', error);
            return 'Error fetching AI answer';
        }
    }

    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url) {
        const ws = new originalWebSocket(url);
        ws.addEventListener('message', async function(event) {
            try {
                const messageArray = JSON.parse(event.data);
                for (let message of messageArray) {
                    if (message.data && message.data.type === 'message' && message.channel === '/service/player') {
                        const content = JSON.parse(message.data.content);
                        if (content.type === 'quiz') {
                            quizData.currentQuestion = content.title || '';
                            quizData.currentChoices = (content.choices || []).map(choice => choice.answer);
                            quizData.imageUrl = content.image || '';
                            quizData.imageMetadata = content.imageMetadata || {};
                            quizData.videoUrl = content.video?.fullUrl || '';
                            quizData.videoService = content.video?.service || '';
                            quizData.layout = content.layout || 'Unknown';
                            quizData.questionIndex = content.questionIndex || 0;
                            quizData.totalQuestions = content.totalGameBlockCount || 0;
                            quizData.timeAvailable = content.timeAvailable || 0;
                            quizData.numberOfAnswersAllowed = content.numberOfAnswersAllowed || 0;
                            quizData.numberOfChoices = content.numberOfChoices || 0;
                            quizData.pointsMultiplier = content.pointsMultiplier || 1;
                            quizData.getReadyTime = content.getReadyTimeAvailable || 0;

                            if (quizData.currentQuestion && quizData.currentChoices.length > 0) {
                                if (quizData.currentQuestion !== lastQuestion || JSON.stringify(quizData.currentChoices) !== JSON.stringify(lastChoices)) {
                                    lastQuestion = quizData.currentQuestion;
                                    lastChoices = quizData.currentChoices.slice();
                                    currentAnswer = 'Waiting for AI answer...';
                                    updateDisplayBox(quizData, currentAnswer);
                                    const aiAnswer = await getAIAnswer(quizData.currentQuestion, quizData.currentChoices, quizData.numberOfAnswersAllowed);
                                    currentAnswer = aiAnswer;
                                    updateDisplayBox(quizData, aiAnswer);
                                } else {
                                    updateDisplayBox(quizData, currentAnswer);
                                }
                            } else {
                                updateDisplayBox(quizData);
                            }
                        }
                    }
                }
            } catch (e) {
                let displayContent = document.getElementById('quizInfoBoxContent') || createDraggableElement('quizInfoBox', '10px', '10px');
                displayContent.innerHTML = '<strong>Error parsing data.</strong>';
            }
        });
        return ws;
    };

    window.addEventListener('load', function() {
        let displayContent = createDraggableElement('quizInfoBox', '10px', '10px');
        displayContent.innerHTML = '<strong>Waiting for data...</strong>';
        createMenu();
    });
})();
