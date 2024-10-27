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
  name = `${epsilon}/${minPoints}`,
  vectorTable = 'embedding',
} = {}) {
  try {
    // await sql`insert into point (scan_name, embedding_id)
    //   select ${name} , id from ${sql(vectorTable)}`;

    // loop until we don't have any unassessed points.
    let focusPoint;
    do {
      focusPoint = (
        await sql`select point.id as point_id, point.cluster_id, embedding.id as embedding_id, embedding.vector 
        from embedding
        left join point on point.scan_name = ${name} and embedding.id = point.embedding_id
        where point.assessed = false or point.assessed is null
--        from point
--        join embedding on embedding.id = point.embedding_id
--        where point.scan_name = $ {name}
--        and point.assessed = false
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
    const neighbors = await sql`SELECT point.id as point_id, ${sql(
      vectorTable
    )}.id as embedding_id
          FROM ${sql(vectorTable)}
          left join point on point.embedding_id = ${sql(vectorTable)}.${sql(
      'id'
    )} 
            and point.scan_name = ${scanName}
          where ${sql(vectorTable)}.vector <=> ${focusPoint.vector} < ${epsilon}
      `;
    if (neighbors.length >= minPoints) {
      const clusterId = focusPoint.cluster_id || getNextClusterId();
      // todo convert to insert with conflict ??
      if (focusPoint.point_id) {
        await sql`update point set
          cluster_id = ${clusterId},
          assessed = true,
          type = 'core'
          where id = ${focusPoint.point_id}
        `;
      } else {
        // await sql`insert into point (cluster_id, assessed, type)
        await sql`insert into point (assessed, embedding_id, scan_name, cluster_id, type) 
        values (true, ${focusPoint.embedding_id}, ${scanName}, ${clusterId}, 'core')
      `;
      }
      const newNeighbors = neighbors.filter((i) => !i.point_id);
      const oldNeighbors = neighbors.filter((i) => i.point_id);
      // insert many for all neighbors
      if (newNeighbors.length) {
        await sql`insert into point (embedding_id, scan_name, cluster_id) 
       values ${sql(
         newNeighbors.map((i) => [i.embedding_id, scanName, clusterId])
       )}`;
      }

      if (oldNeighbors.length) {
        await sql`update point set cluster_id = ${clusterId}
          where id = ANY (${oldNeighbors.map((i) => i.point_id)})
          and cluster_id is null
        `;
      }
    } else {
      if (focusPoint.point_id) {
        await sql`update point set
          assessed = true
          where id = ${focusPoint.point_id}
        `;
      } else {
        await sql`insert into point (assessed, embedding_id, scan_name) 
        values (true, ${focusPoint.embedding_id}, ${scanName} )`;
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
