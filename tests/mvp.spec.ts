import { expect, test, type Page } from '@playwright/test';
import { emptyHistory, type History } from '../src/domain/world/model';
import { stopQuestion } from '../src/content/questions/stop';
import { trafficQuestions } from '../src/content/questions/traffic';
import { cause } from '../src/domain/violations/causes';
async function seed(page: Page, history: History) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Поехать в город', exact: true })).toBeEnabled();
  await page.evaluate(async (value) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('pdd-city', 1);
      open.onsuccess = () => {
        const db = open.result,
          tx = db.transaction('history', 'readwrite');
        tx.objectStore('history').put(value, 'current');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error('History write failed'));
      };
      open.onerror = () => reject(open.error ?? new Error('History open failed'));
    });
  }, history);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Поехать в город', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: /^Журнал/ }).click();
}
function fixture(count = 1): History {
  return {
    ...emptyHistory(),
    trips: [
      {
        id: 'trip',
        startedAt: '2026-10-09T10:00:00Z',
        finishedAt: '2026-10-09T10:10:00Z',
        status: 'finished',
      },
    ],
    violations: Array.from({ length: count }, (_, i) => ({
      id: `v-${i}`,
      tripId: 'trip',
      attemptId: 'a',
      date: `2026-10-09T10:00:${String(i % 60).padStart(2, '0')}Z`,
      type: 'stop',
      speed: 4,
      tick: i,
      episode: i + 1,
      roadObjectId: 'garden-south',
      mapVersion: 'neighborhood-2',
      rulesVersion: 'mvp-preview-2',
      causes: [cause('stop-line', { speedKmh: 14.4 })],
      material: structuredClone(stopQuestion),
    })),
  };
}
async function fits(page: Page) {
  const layout = await page.getByRole('dialog').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      inside: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1,
      scroll: el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
      clipped: [...el.querySelectorAll('button, h2, h3, p, a, select, img, .journal-list')].some(
        (c) => {
          if (
            !c.getClientRects().length ||
            (c.closest('.journal-list') !== null && !c.matches('.journal-list'))
          ) {
            return false;
          }
          const b = c.getBoundingClientRect();
          return (
            b.top < r.top || b.bottom > r.bottom + 1 || b.left < r.left || b.right > r.right + 1
          );
        },
      ),
    };
  });
  expect(layout).toEqual({ inside: true, scroll: false, clipped: false });
}
test('scrollable journal, filters, attempt history and keyboard return preserve position', async ({
  page,
}) => {
  const data = fixture(121);
  data.answers = [
    {
      id: 'a',
      violationId: 'v-20',
      questionId: stopQuestion.id,
      contentVersion: stopQuestion.version,
      answer: 1,
      correct: false,
      assisted: false,
      date: '2026-10-09T10:10:00Z',
    },
    {
      id: 'b',
      violationId: 'v-20',
      questionId: stopQuestion.id,
      contentVersion: stopQuestion.version,
      answer: 0,
      correct: true,
      assisted: true,
      date: '2026-10-09T10:11:00Z',
    },
  ];
  data.skips = [{ id: 'skip', violationId: 'v-20', date: '2026-10-09T10:09:00Z' }];
  data.revealed = ['v-20'];
  await seed(page, data);
  const list = page.getByRole('region', { name: 'Записи журнала' });
  await expect(list.getByRole('button')).toHaveCount(121);
  await expect(page.getByRole('button', { name: 'Страница: вперёд' })).toHaveCount(0);
  expect((await page.getByRole('dialog').boundingBox())!.width).toBeGreaterThan(650);
  const entry = list.locator('[data-entry-id="v-20"]');
  await entry.scrollIntoViewIfNeeded();
  const position = await list.evaluate((el) => el.scrollTop);
  expect(position).toBeGreaterThan(0);
  await entry.click();
  await page.getByRole('button', { name: 'Попытки (3)' }).click();
  await expect(page.getByText(/Пропуск: продолжение/)).toBeVisible();
  await page.getByRole('button', { name: 'Попытка: вперёд' }).click();
  await expect(page.getByText('Ответ 2: ошибка · самостоятельно')).toBeVisible();
  await page.getByRole('button', { name: 'Назад в журнал' }).click();
  await expect(entry).toBeFocused();
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(position);
  await page.getByLabel('Результат ответа').selectOption('wrong');
  await expect(page.getByRole('button', { name: /Проезд без остановки/ })).toHaveCount(1);
  await page.getByLabel('Результат ответа').selectOption('unanswered');
  await expect(list.getByRole('button')).toHaveCount(120);
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(0);
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [1024, 650],
    [700, 700],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await fits(page);
    const actions = await page.locator('.journal-modal .modal-actions').boundingBox();
    await list.getByRole('button').last().scrollIntoViewIfNeeded();
    await expect(list.getByRole('button').last()).toBeInViewport();
    expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await page.locator('.journal-modal .modal-actions').boundingBox()).toEqual(actions);
    await fits(page);
    if (width === 1440 || width === 390) {
      await page.screenshot({ path: `test-results/journal-scroll-${width}.png` });
    }
  }
  await page.getByLabel('Результат ответа').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /Проезд без остановки/ }).first()).toBeFocused();
  await page.getByRole('button', { name: 'Очистить историю' }).click();
  await fits(page);
  await page.getByRole('button', { name: 'Отмена' }).click();
  await expect(list.getByRole('button')).toHaveCount(120);
});
test('all new rule cards fit after reveal and answer on compact displays', async ({ page }) => {
  const data = fixture(trafficQuestions.length);
  data.violations = data.violations.map((v, i) => ({
    ...v,
    type: trafficQuestions[i].rule,
    causes: trafficQuestions[i].matches!.map((code) =>
      cause(code, {
        limitKmh: 30,
        speedKmh: 35,
        signal: 'red',
        direction: 'left',
        initialIndicator: 'off',
        intendedSpeed: 1.2,
      }),
    ),
    material: trafficQuestions[i],
  }));
  await seed(page, data);
  for (const q of trafficQuestions) {
    await page.getByLabel('Вид нарушения').selectOption(q.rule);
    await page.locator('.journal-list > button').click();
    await page.getByRole('button', { name: 'Показать разбор', exact: true }).click();
    if (await page.getByRole('button', { name: 'Вопрос', exact: true }).isVisible()) {
      await page.getByRole('button', { name: 'Вопрос', exact: true }).click();
    }
    await page.getByRole('button', { name: q.options[0], exact: false }).click();
    for (const [width, height] of [
      [1280, 720],
      [1024, 650],
      [600, 700],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await fits(page);
    }
    if (q.rule === 'indicator') {
      await page.getByRole('button', { name: 'Обстоятельства', exact: true }).click();
      await page.getByRole('button', { name: 'Причина: вперёд' }).click();
      await fits(page);
    }
    await page.getByRole('button', { name: 'Назад в журнал' }).click();
  }
});
test('long local material and image are accessible in pages without scrolling', async ({
  page,
}) => {
  const data = fixture();
  const q = data.violations[0].material!;
  q.title = 'Тест длинного материала. '.repeat(35);
  q.options = [
    'Длинный вариант для проверки переноса. '.repeat(20),
    'Второй вариант',
    'Третий вариант',
  ];
  q.explanation = 'Пояснение для проверки страниц текста. '.repeat(30);
  q.image = {
    src: '/assets/questions/demo-stop-line/demo-2/layout-test.svg',
    alt: 'Тестовая схема, не экзаменационный материал',
    source: 'Синтетическая фикстура',
    usage: 'Только автоматический тест',
  };
  await page.route('**/assets/questions/**/layout-test.svg', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#dce5d5"/><path d="M0 100H400" stroke="#737e7c" stroke-width="40"/></svg>',
    }),
  );
  await seed(page, data);
  await page.locator('.journal-list > button').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await fits(page);
  await page.getByRole('button', { name: 'Вопрос', exact: true }).click();
  await page.getByRole('button', { name: 'Текст: вперёд' }).click();
  await fits(page);
  await page.getByRole('button', { name: 'Иллюстрация', exact: true }).click();
  await expect(page.getByRole('img')).toBeVisible();
  await fits(page);
  await page.getByRole('button', { name: 'Варианты ответа' }).click();
  await page.getByRole('button', { name: 'Текст: вперёд' }).click();
  await fits(page);
  await page.getByRole('button', { name: 'Выбрать вариант 1' }).click();
  await fits(page);
});
test('speed limit stays visible despite legacy settings and a clean trip has its own summary', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'pdd-settings',
      JSON.stringify({ schemaVersion: 1, showSpeedLimit: false }),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await expect(page.locator('.dashboard .speed-limit')).toBeVisible();
  await expect(page.locator('#road')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Продолжить поездку', exact: true }).click();
  await page.getByRole('button', { name: 'Завершить поездку', exact: true }).click();
  await expect(page.getByText(/Итог завершённой поездки: 0 нарушений/)).toBeVisible();
  await page.getByRole('button', { name: 'Очистить историю' }).click();
  await page.getByRole('button', { name: 'Да, удалить' }).click();
  await expect(page.getByText('Всего: 0 поездок · 0 нарушений · 0 ответов')).toBeVisible();
});
test('pause and keyboard indicator toggle remain usable in a compact viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 650 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await expect(page.locator('#road')).toBeFocused();
  await page.keyboard.down('KeyQ');
  await page.keyboard.down('KeyQ');
  await expect(page.getByRole('button', { name: 'Левый поворотник' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.up('KeyQ');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Продолжить поездку', exact: true }),
  ).toBeInViewport();
  const box = await page.locator('.pause-card').boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(650);
  expect(
    await page.locator('.pause-card h2').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/pause-compact.png' });
});
