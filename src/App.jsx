import React, { useState } from 'react';
import LSPConnectedEditor from './LSPEditior';

const App = () => {
  const [code, setCode] = useState(`name = 'Chandio'\nprint(f"Hello {name}")`);

  const saveCode = () => {
    console.log('UIAC Code');
    console.log(code);
  };

  const onCodeChange = (changedCode) => {
    setCode(changedCode);
  };

  return (
    <div>
      <h2>Python Code Editor</h2>
      <LSPConnectedEditor
        uiac={code}
        theme="vs-dark"
        language="python"
        onCodeChange={onCodeChange}
        readOnly={false}
        width="100%"
      />
      <button onClick={saveCode}>Save Code</button>
    </div>
  );
};

export default App;
