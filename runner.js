// runner.js used purely for manual testing purposes

const { scan } = require('./index');

(async () => {
  console.time('scan');
  // scan({ name: 'test 4', epsilon: 0.07, minPoints: 10 });
  // scan({ name: 'test 8', epsilon: 0.03, minPoints: 20 });
  // scan({ epsilon: 0.04, minPoints: 10 });
  const epsilon = 0.03;
  const minPoints = 5;
  const name = `timetest 3: ${epsilon}/${minPoints}`;

  await scan({
    vectorTable: 'embedding',
    clusterTable: 'no_point',
    epsilon,
    minPoints,
    name,
  });
  console.timeEnd('scan');
})();
