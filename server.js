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

    // --- ПРОФЕСІЙНА ПЕРЕВІРКА НА "СМІТТЯ" ТА СПАМ (Виправлення БАГУ №1) ---
    // 1. Захист від "залипання" клавіш (якщо користувач ввів "ааааа" або "!!!!")
    if (/(.)\1{3,}/.test(textToClassify)) {
        writeLog('Виявлено спам-символи (залипання клавіш)', 'WARNING');
        return res.status(400).json({ error: 'екст містить неприродне повторення символів. Це не документ!' });
    }

    // 2. Перевірка на наявність реальних слів (мінімум 2 літери у слові)
    const validWords = textToClassify.match(/[а-яА-ЯіІїЇєЄґҐa-zA-Z]{2,}/g);

    // Якщо нормальних слів менше двох - відхиляємо
    if (!validWords || validWords.length < 2) {
        writeLog('Текст схожий на набір символів', 'WARNING');
        return res.status(400).json({ error: 'Документ має містити хоча б два змістовних слова!' });
    }
    // -------------------------------------------------

    try {
        // Отримуємо масив ймовірностей для кожної категорії
        const classifications = classifier.getClassifications(textToClassify);

        // Якщо ймовірність найпершої категорії дорівнює ймовірності останньої - 
        // це означає, що ШІ не розпізнав ЖОДНОГО слова і просто вгадує наосліп.
        if (classifications[0].value === classifications[classifications.length - 1].value) {
            writeLog('Модель не впізнала словник (можливий спам/невідомий текст)', 'WARNING');
            return res.status(400).json({ error: 'Система не розпізнала зміст. Введіть коректний службовий текст!' });
        }

        // Беремо категорію з найвищим балом (першу в списку)
        const category = classifications[0].label;

        writeLog(`Текст успішно класифіковано як: ${category}`);
        res.json({ category: category });
    } catch (error) {
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