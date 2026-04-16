import express from 'express';

const app = express();
const port = 3000;

app.get('/pi', (req, res) => {
  const piValue = Math.PI;
  console.log(`PI value is ${piValue}`);
  res.send({ pi: piValue });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
