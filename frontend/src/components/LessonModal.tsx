import { useState } from "react";
import type { Hotspot } from "../types";

interface Props {
  hotspot: Hotspot;
  onClose: () => void;
}

export default function LessonModal({ hotspot, onClose }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const { lesson } = hotspot;
  const isCorrect = selected === lesson.answerIndex;

  return (
    <div
      role="dialog"
      aria-label={lesson.title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 12, 30, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fffaf0",
          borderRadius: 24,
          padding: "1.5rem 1.75rem",
          maxWidth: 420,
          width: "90%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          border: "6px solid #ffd35c",
        }}
      >
        <h2 style={{ marginTop: 0, color: "#3a2c1a" }}>{lesson.title}</h2>
        <p style={{ color: "#4a3f2f", lineHeight: 1.5 }}>{lesson.fact}</p>

        <p style={{ fontWeight: "bold", color: "#3a2c1a" }}>{lesson.question}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lesson.choices.map((choice, i) => {
            const isSelected = selected === i;
            const showCorrect = selected !== null && i === lesson.answerIndex;
            return (
              <button
                key={choice}
                onClick={() => setSelected(i)}
                disabled={isCorrect}
                style={{
                  padding: "0.6rem 0.9rem",
                  borderRadius: 12,
                  border: "2px solid #d8c8a0",
                  background: showCorrect
                    ? "#c8ecc8"
                    : isSelected
                      ? "#f7c8c8"
                      : "#fff",
                  cursor: isCorrect ? "default" : "pointer",
                  textAlign: "left",
                  fontSize: "1rem",
                }}
              >
                {choice}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <p
            style={{
              marginTop: 12,
              fontWeight: "bold",
              color: isCorrect ? "#2f7a2f" : "#8a3f3f",
            }}
          >
            {isCorrect ? lesson.successMessage : "Not quite — take another look above and try again!"}
          </p>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            padding: "0.5rem 1.2rem",
            borderRadius: 999,
            border: "none",
            background: "#3a2c1a",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
