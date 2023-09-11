import React from 'react';
import LSPConnectedEditor from './LSPEditior';

const App = () => {
  const code = `name = 'Chandio'\nprint(f"Hello {name}")`;

  return (
    <div>
      <h2>Python Code Editor</h2>
      <LSPConnectedEditor uiac={code} />
    </div>
  );
};

export default App;
