const express = require('express');
const fs = require('fs');
const path = require('path');
const natural = require('natural');

const config = require('./config.json');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function writeLog(message, type = 'INFO') {
    const date = new Date().toLocaleString('uk-UA');
    const logLine = `[${date}] [${type}]: ${message}\n`;
    try {
        fs.appendFileSync(config.log_file_path, logLine);
        console.log(logLine.trim());
    } catch (err) {
        console.error("Помилка логів:", err);
    }
}

// === МАШИННЕ НАВЧАННЯ (Виправлено) ===
// Додаємо PorterStemmerRu, щоб ШІ "бачив" українські літери
const classifier = new natural.BayesClassifier(natural.PorterStemmerRu);

classifier.addDocument('Прошу надати мені відпустку за сімейними обставинами', 'Заява');
classifier.addDocument('Прошу звільнити мене за власним бажанням', 'Заява');
classifier.addDocument('Наказую призначити премію співробітникам відділу', 'Наказ');
classifier.addDocument('Звільнити працівника з посади', 'Наказ');
classifier.addDocument('Надсилаємо вам акт виконаних робіт для ознайомлення', 'Лист');
classifier.addDocument('Відправляємо договір на підписання', 'Лист');

classifier.train();
writeLog('Модель машинного навчання натренована (з підтримкою кирилиці!).');

classifier.save(config.model_file_path, function (err, classifier) {
    if (err) writeLog(`Помилка збереження моделі: ${err}`, 'ERROR');
    else writeLog('Модель збережено у файл.');
});

// === API ДЛЯ ЗВ'ЯЗКУ З ІНТЕРФЕЙСОМ ===
app.post('/classify', (req, res) => {
    const textToClassify = req.body.text;

    if (!textToClassify || textToClassify.trim() === '') {
        writeLog('Спроба класифікувати порожній текст', 'WARNING');
        return res.status(400).json({ error: 'Текст не може бути порожнім!' });
    }

    try {
        const category = classifier.classify(textToClassify);
        writeLog(`Текст успішно класифіковано як: ${category}`);
        res.json({ category: category });
    } catch (error) {
        // Тепер, якщо буде помилка, ми точно побачимо її текст
        const errorMessage = error.message ? error.message : JSON.stringify(error);
        writeLog(`Помилка класифікації: ${errorMessage}`, 'ERROR');
        res.status(500).json({ error: 'Помилка аналізу тексту.' });
    }
});

try {
    app.listen(config.port, () => {
        writeLog(`Сервер працює на порту: ${config.port}`);
    });
} catch (error) {
    writeLog(`Помилка запуску: ${error.message}`, 'ERROR');
}