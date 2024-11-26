
export async function goToNotificationPage(page) {

    try {

        // Введення username
        await page.waitForSelector('#username'); // Чекаємо на появу поля username
        await page.type('#username', 'igorvinson@gmail.com', {delay: Math.random() * 100}); // Вводимо username (емейл)
        await page.click('button[type="submit"]'); // Натискаємо кнопку "Submit" після введення username

        // choose 3 element of MastheadMd__list__FYBzo and click
        const mastheadElements = await page.$$('.MastheadMd__list__FYBzo');
        const notifyElement = mastheadElements[2];
        await notifyElement.click();

    }
    catch (error) {
        console.error('Помилка при подачі заявки:', error);
    }

    return page
}


