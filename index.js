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
  vectorTable = '${sql(vectorTable)}',
  clusterTable = 'point',
  vectorId = 'id',
  vectorColumn = 'vector',
} = {}) {
  try {
    let focusPoint;
    do {
      focusPoint = (
        await sql`select ${sql(clusterTable)}.id as point_id, ${sql(
          clusterTable
        )}.cluster_id, ${sql(vectorTable)}.id as embedding_id, ${sql(vectorTable)}.${sql(vectorColumn)} 
        from ${sql(vectorTable)}
        left join ${sql(clusterTable)} on ${sql(
          clusterTable
        )}.scan_name = ${name} and ${sql(vectorTable)}.id = ${sql(
          clusterTable
        )}.embedding_id
        where ${sql(clusterTable)}.assessed = false or ${sql(
          clusterTable
        )}.assessed is null
        order by ${sql(clusterTable)}.cluster_id
        limit 1`
      )[0];
      if (focusPoint) {
        await assessSurroundingArea({
          focusPoint,
          epsilon,
          minPoints,
          scanName: name,
          vectorTable,
          vectorId,
          vectorColumn,
          clusterTable,
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
  vectorId,
  vectorColumn,
  clusterTable,
}) {
  try {
    const neighbors = await sql`SELECT ${sql(
      clusterTable
    )}.id as point_id, ${sql(vectorTable)}.${sql(vectorId)} as embedding_id
          FROM ${sql(vectorTable)}
          left join ${sql(clusterTable)} on ${sql(
      clusterTable
    )}.embedding_id = ${sql(vectorTable)}.${sql('id')} 
            and ${sql(clusterTable)}.scan_name = ${scanName}
          where ${sql(vectorTable)}.${sql(vectorColumn)} <=> ${focusPoint.vector} < ${epsilon}
      `;
    if (neighbors.length >= minPoints) {
      const clusterId = focusPoint.cluster_id || getNextClusterId();
      // todo convert to insert with conflict ??
      if (focusPoint.point_id) {
        await sql`update ${sql(clusterTable)} set
          cluster_id = ${clusterId},
          assessed = true,
          type = 'core'
          where id = ${focusPoint.point_id}
        `;
      } else {
        await sql`insert into ${sql(
          clusterTable
        )} (assessed, embedding_id, scan_name, cluster_id, type) 
        values (true, ${
          focusPoint.embedding_id
        }, ${scanName}, ${clusterId}, 'core')
      `;
      }
      const newNeighbors = neighbors.filter((i) => !i.point_id);
      const oldNeighbors = neighbors.filter((i) => i.point_id);
      if (newNeighbors.length) {
        await sql`insert into ${sql(
          clusterTable
        )} (embedding_id, scan_name, cluster_id) 
       values ${sql(
         newNeighbors.map((i) => [i.embedding_id, scanName, clusterId])
       )}`;
      }

      if (oldNeighbors.length) {
        await sql`update ${sql(clusterTable)} set cluster_id = ${clusterId}
          where id = ANY (${oldNeighbors.map((i) => i.point_id)})
          and cluster_id is null
        `;
      }
    } else {
      if (focusPoint.point_id) {
        await sql`update ${sql(clusterTable)} set
          assessed = true
          where id = ${focusPoint.point_id}
        `;
      } else {
        await sql`insert into ${sql(
          clusterTable
        )} (assessed, embedding_id, scan_name) 
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
