import * as React from "react";
import * as ReactDOM from "react-dom";

const Component = () => {
  return (
    <div>
      <p>Hello world!</p>
    </div>
  );
};

export const initialize = (): void => {
  ReactDOM.render(<Component />, document.getElementById("root"));
};
