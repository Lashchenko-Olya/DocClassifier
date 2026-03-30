const assert = require('assert');
const natural = require('natural');

console.log('Запуск Unit-тестування ML-моделі...');

try {
    const classifier = new natural.BayesClassifier(natural.PorterStemmerRu);
    classifier.addDocument('прошу звільнити мене', 'Заява');
    classifier.addDocument('наказую призначити', 'Наказ');
    classifier.train();

    const testText = 'прошу перевести мене в інший відділ';
    const result = classifier.classify(testText);

    assert.strictEqual(result, 'Заява', 'Помилка: Класифікатор не розпізнав заяву!');
    console.log('Unit-тест №1: Класифікація тексту пройшла успішно!');
} catch (error) {
    console.error('Unit-тест провалено:', error.message);
}