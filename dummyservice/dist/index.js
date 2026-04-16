"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const port = 3000;
app.get('/pi', (req, res) => {
    const piValue = Math.PI;
    console.log(`PI value is ${piValue}`);
    res.send({ pi: piValue });
});
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
