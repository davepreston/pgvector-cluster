const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);
// let configData = {};

module.exports = {
  scan,
  // config,
};

// // todo consider border points as noise as an option
// async function config(data) {
//   configData = { ...data };
// }

async function scan({
  epsilon,
  minPoints,
  name = `test3: ${epsilon}/${minPoints}`,
  vectorTable = 'embedding',
} = {}) {
  try {
    await sql`insert into point (scan_name, embedding_id, updated_at)
  select ${name} , id, now() from ${sql(vectorTable)}`;

    // loop until we don't have any unassessed points.
    let focusPoint;
    do {
      focusPoint = (
        await sql`select point.id, point.cluster_id, embedding.id as embedding_id, embedding.vector from point
        join embedding on embedding.id = point.embedding_id
        where point.scan_name = ${name}
        and point.assessed = false
        order by point.cluster_id
        limit 1`
      )[0];
      if (focusPoint) {
        await assessSurroundingArea({
          focusPoint,
          epsilon,
          minPoints,
          scanName: name,
          vectorTable,
        });
      }
      console.log('end of loop');
    } while (focusPoint);

    console.log('done');
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function assessSurroundingArea({
  focusPoint,
  epsilon,
  minPoints,
  scanName,
  vectorTable,
}) {
  try {
    const res = await sql`SELECT point.id
          FROM ${sql(vectorTable)}
          join point on point.embedding_id = ${sql(vectorTable)}.${sql('id')}
          where point.scan_name = ${scanName}
          and ${sql(vectorTable)}.vector <=> ${focusPoint.vector} < ${epsilon}
      `;
    if (res.length >= minPoints) {
      const clusterId = focusPoint.cluster_id || getNextClusterId();
      await sql`update point set
          cluster_id = ${clusterId},
          assessed = true,
          type = 'core'
          where id = ${focusPoint.id}
        `;
      await sql`update point set cluster_id = ${clusterId}
          where id = ANY (${res.map((i) => i.id)})
          and cluster_id is null
        `;
    } else {
      if (focusPoint.cluster_id) {
        await sql`update point set
          assessed = true
          where id = ${focusPoint.id}
        `;
      } else {
        await sql`update point set
              assessed = true
              where id = ${focusPoint.id}
            `;
      }
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

let clusterId = 0;
function getNextClusterId() {
  clusterId++;
  return clusterId;
}
