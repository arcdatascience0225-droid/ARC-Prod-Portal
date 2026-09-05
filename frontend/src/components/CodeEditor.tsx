import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  language: string;
  value: string;
  onChange: (value: string) => void;
  height?: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  python: "python",
  python3: "python",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  cpp: "cpp",
  c: "c",
  sql: "sql",
};

export default function CodeEditor({ language, value, onChange, height = "420px" }: CodeEditorProps) {
  const handleMount = (_editor: unknown, monaco: any) => {
    // Monaco's bundled "python" language has no smart indentation rules out
    // of the box (that normally comes from a language server), so typing
    // after a colon or a new block keeps the previous line's indent instead
    // of adding one — forcing students to indent every line by hand. This
    // teaches Monaco the same increase/decrease indent rules a real Python
    // IDE uses.
    monaco.languages.setLanguageConfiguration("python", {
      indentationRules: {
        increaseIndentPattern: /^.*:\s*(#.*)?$/,
        decreaseIndentPattern: /^\s*(elif\b|else\b|except\b|finally\b).*:\s*(#.*)?$/,
      },
      onEnterRules: [
        {
          beforeText: /:\s*(#.*)?$/,
          action: { indentAction: monaco.languages.IndentAction.Indent },
        },
      ],
    });
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200">
      <Editor
        height={height}
        language={LANGUAGE_MAP[language.toLowerCase()] || "plaintext"}
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          autoIndent: "full",
        }}
      />
    </div>
  );
}
