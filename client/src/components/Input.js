import React, { Component } from 'react';

class Input extends Component {
    constructor(props) {
        super(props);
        this.state = {
            value: "",
            showPassword: false,
        }
        this.keySubmit = this.keySubmit.bind(this);
        this.onInput = this.onInput.bind(this);
        this.showPassword = this.showPassword.bind(this);
        this.focus = this.focus.bind(this);
        this.blur = this.blur.bind(this);
        this.addChip = this.addChip.bind(this);

    }

    focus() {
        window.addEventListener('keyup', this.keySubmit)
    }
    blur() {
        window.removeEventListener('keyup', this.keySubmit);
    }
    keySubmit(e) {
        if (e.key === 'Enter') {
            if (this.props.enter) {
                this.props.enter();
            }
        }
        if (e.key === ' ' || e.key === 'Enter' || e.key === ',') {
            if (this.props.type === 'chip') {
                this.addChip(this.state.value);
            }
        }
    }
    addChip(value) {
        let result = value.replace(/[ ,]/g, '');
        this.setState({
            value: '',
        });
        if (result.length < 1) return;
        this.props.addChip(result);
    }

    onInput(e) {
        this.props.onInput(e.target.value);
        this.setState({
            value: e.target.value,
        });
    }

    showPassword() {
        this.setState({
            showPassword: !this.state.showPassword,
        });
    }

    render() {
        const type = this.props.type === 'chip' ? 'text' : this.state.showPassword ? "text" : this.props.type;
        return (
            <div className={'Input ' + this.props.className} style={{width: this.props.width}}>
                <div className='placeholder' style={{color: this.state.value.length > 0 ? "transparent" : "#E4E4E4"}}>{this.props.placeholder}</div>
                <input type={type} onInput={this.onInput} value={this.state.value} onFocus={this.focus} onBlur={this.blur} />
                <img onClick={this.showPassword} className='eye' style={{display: this.props.type === "password" ? "block" : "none"}} src='/images/icons/eye.svg' alt='eye'/>
            </div>
        );
    }
}

export default Input;