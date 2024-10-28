const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

module.exports = {
  scan,
};

async function scan({
  epsilon,
  minPoints,
  name = `${epsilon}/${minPoints}`,
  vectorTable = 'vector',
  vectorId = 'id',
  vectorColumn = 'vector',
  clusterTable = 'point',
} = {}) {
  try {
    await createTableIfNecessary({ clusterTable });
    let focusPoint;
    do {
      focusPoint = (
        await sql`select ${sql(clusterTable)}.id as point_id, ${sql(
          clusterTable
        )}.cluster_id, ${sql(vectorTable)}.id as vector_id, ${sql(
          vectorTable
        )}.${sql(vectorColumn)} 
        from ${sql(vectorTable)}
        left join ${sql(clusterTable)} on ${sql(
          clusterTable
        )}.scan_name = ${name} and ${sql(vectorTable)}.id = ${sql(
          clusterTable
        )}.vector_id
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
      // console.log('end of loop');
    } while (focusPoint);

    // console.log('done');
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
    )}.id as point_id, ${sql(vectorTable)}.${sql(vectorId)} as vector_id
          FROM ${sql(vectorTable)}
          left join ${sql(clusterTable)} on ${sql(
      clusterTable
    )}.vector_id = ${sql(vectorTable)}.${sql('id')} 
            and ${sql(clusterTable)}.scan_name = ${scanName}
          where ${sql(vectorTable)}.${sql(vectorColumn)} <=> ${
      focusPoint[vectorColumn]
    } < ${epsilon}
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
        )} (assessed, vector_id, scan_name, cluster_id, type) 
        values (true, ${
          focusPoint.vector_id
        }, ${scanName}, ${clusterId}, 'core')
      `;
      }
      const newNeighbors = neighbors.filter((i) => !i.point_id);
      const oldNeighbors = neighbors.filter((i) => i.point_id);
      if (newNeighbors.length) {
        await sql`insert into ${sql(
          clusterTable
        )} (vector_id, scan_name, cluster_id) 
       values ${sql(
         newNeighbors.map((i) => [i.vector_id, scanName, clusterId])
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
        )} (assessed, vector_id, scan_name) 
        values (true, ${focusPoint.vector_id}, ${scanName} )`;
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

async function createTableIfNecessary({ clusterTable }) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS ${sql(clusterTable)} (
    id SERIAL PRIMARY KEY,
    scan_name TEXT NOT NULL,
    vector_id INTEGER NOT NULL,
    assessed BOOLEAN NOT NULL DEFAULT false,
    cluster_id INTEGER,
    type TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;
  } catch (error) {
    console.error('Issue creating table: ', error);
  }
}
