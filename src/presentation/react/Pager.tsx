import { useState } from 'react';
export function Pager({
  page,
  total,
  onChange,
  label = 'Страница',
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
  label?: string;
}) {
  const safe = Math.min(page, Math.max(0, total - 1));
  return (
    <span className="pagination" role="group" aria-label={label}>
      <button
        className="secondary"
        disabled={safe === 0}
        onClick={() => onChange(safe - 1)}
        aria-label={`${label}: назад`}
      >
        ←
      </button>
      <span>
        {label} {safe + 1} / {Math.max(1, total)}
      </span>
      <button
        className="secondary"
        disabled={safe >= total - 1}
        onClick={() => onChange(safe + 1)}
        aria-label={`${label}: вперёд`}
      >
        →
      </button>
    </span>
  );
}
export function PagedText({ text, limit = 340 }: { text: string; limit?: number }) {
  const [page, setPage] = useState(0);
  const words = text.split(' '),
    chunks: string[] = [''];
  for (const word of words) {
    if (chunks[chunks.length - 1].length + word.length > limit) {
      chunks.push('');
    }
    chunks[chunks.length - 1] += `${word} `;
  }
  return (
    <>
      {chunks[Math.min(page, chunks.length - 1)]}
      {chunks.length > 1 && (
        <Pager page={page} total={chunks.length} onChange={setPage} label="Текст" />
      )}
    </>
  );
}
