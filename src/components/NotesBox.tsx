import { useEffect, useRef, useState } from 'react';
import { getNote, setNote } from '../lib/notes';

export function NotesBox({ id }: { id: string }) {
  const [text, setText] = useState(() => getNote(id));
  const [saved, setSaved] = useState(true);
  const timer = useRef<number>(undefined);

  // 입력 후 0.5초 뒤 자동 저장
  useEffect(() => {
    if (saved) return;
    timer.current = window.setTimeout(() => {
      setNote(id, text);
      setSaved(true);
    }, 500);
    return () => window.clearTimeout(timer.current);
  }, [id, text, saved]);

  return (
    <section className="notes">
      <h2>
        My notes <span className="save-state">{saved ? '저장됨' : '입력 중…'}</span>
      </h2>
      <textarea
        value={text}
        placeholder="수업 내용, 임상 경험, 헷갈리는 포인트 등을 적어두세요. (이 브라우저에 자동 저장)"
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={5}
      />
    </section>
  );
}
