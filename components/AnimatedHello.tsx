"use client";

import { useEffect, useState } from "react";

const TEXT = "Hello";
const CHAR_INTERVAL = 300; // ms per letter
const PAUSE_AFTER = 900;   // ms to hold before restarting

export default function AnimatedHello({ style }: { style?: React.CSSProperties }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function tick(n: number) {
      if (n < TEXT.length) {
        timeout = setTimeout(() => {
          setCount(n + 1);
          tick(n + 1);
        }, CHAR_INTERVAL);
      } else {
        // finished — pause then restart
        timeout = setTimeout(() => {
          setCount(0);
          tick(0);
        }, PAUSE_AFTER);
      }
    }

    tick(count);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span style={style}>
      {TEXT.slice(0, count)}
      <span
        style={{
          display: "inline-block",
          width: "2px",
          height: "1em",
          verticalAlign: "text-bottom",
          marginLeft: "1px",
          background: "currentColor",
          opacity: count === TEXT.length ? 0 : 1,
        }}
      />
    </span>
  );
}
