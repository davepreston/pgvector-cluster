const pg = require('pg');

// let configData = {};

module.exports = {
  scan,
  // config,
};

// // todo consider border points as noise as an option
// async function config(data) {
//   configData = { ...data };
// }

async function scan({ name, epsilon, minPoints } = {}) {
  name ??= `test: ${epsilon}/${minPoints}`;
  const { Pool } = pg;
  const connectionString = process.env.DATABASE_URL;

  const pool = new Pool({
    connectionString,
  });

  const client = await pool.connect();

  await client.query(
    `insert into point (scan_name, embedding_id, updated_at)
    select $1 , id, now() from embedding`,
    [name]
  );
  // loop until we don't have any unassessed points.
  let focusPoint;
  do {
    focusPoint = (
      await client.query(
        `select point.id, point.cluster_id, embedding.id as embedding_id, embedding.vector from point 
        join embedding on embedding.id = point.embedding_id
        where point.scan_name = $1 
        and point.assessed = false
        order by point.cluster_id
        limit 1`,
        [name]
      )
    ).rows[0];
    if (focusPoint) {
      await assessSurroundingArea({
        client,
        focusPoint,
        epsilon,
        minPoints,
        scanName: name,
      });
    }
    console.log('end of loop');
  } while (focusPoint);

  console.log('done');
  await client.release();
}

async function assessSurroundingArea({
  client,
  focusPoint,
  epsilon,
  minPoints,
  scanName,
}) {
  const res = await client.query(
    `SELECT point.id
          FROM embedding 
          join point on point.embedding_id = embedding.id
          where point.scan_name = $3
          and embedding.vector <=> $1 < $2
      `,
    [focusPoint.vector, epsilon, scanName]
  );
  if (res.rows.length >= minPoints) {
    const clusterId = focusPoint.cluster_id || getNextClusterId();
    await client.query(
      `update point set
          cluster_id = $1,
          assessed = true,
          type = 'core'
          where id = $2
        `,
      [clusterId, focusPoint.id]
    );
    await client.query(
      `update point set cluster_id = $1
          where id = ANY ($2)
          and cluster_id is null
        `,
      [clusterId, res.rows.map((i) => i.id)]
    );
  } else {
    if (focusPoint.cluster_id) {
      await client.query(
        `update point set 
          assessed = true,
--          type = 'border'
          where id = $1
        `,
        [focusPoint.id]
      );
    } else {
      await client.query(
        `update point set 
              assessed = true
              where id = $1
            `,
        [focusPoint.id]
      );
    }
  }
}

let clusterId = 0;
function getNextClusterId() {
  clusterId++;
  return clusterId;
}
