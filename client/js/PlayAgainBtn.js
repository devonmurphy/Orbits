import React, { Component } from "react";
import { hot } from "react-hot-loader";
import "../css/GameSelectBtn.css";

class PlayAgainBtn extends Component {
  constructor(props) {
    super(props);

  }

  onClick() {
    window.location.reload();
  }

  render() {
    return (
          <button onClick={this.onClick}><a>Play Again</a></button>
    );
  }
}

export default hot(module)(PlayAgainBtn);
