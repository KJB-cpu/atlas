import { useEffect, useState } from 'react';

/** '#/m/gluteus-medius' 형태의 간단한 해시 라우팅 → 선택된 근육 id */
function parse(): string | null {
  const m = window.location.hash.match(/^#\/m\/([\w-]+)/);
  return m ? m[1] : null;
}

export function useSelectedId(): [string | null, (id: string | null) => void] {
  const [id, setId] = useState<string | null>(parse);
  useEffect(() => {
    const onHash = () => setId(parse());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const select = (next: string | null) => {
    window.location.hash = next ? `/m/${next}` : '';
  };
  return [id, select];
}
