export async function lockSofLaytimeNomination(connection, comId, moduleId, companyId) {
  // A new SOF or Laytime port has no master row to lock yet.
  const [[nomination]] = await connection.query(
    `SELECT FCAID FROM freight_cost_estimate_compare
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ? FOR UPDATE`,
    [comId, moduleId, companyId],
  );
  if (!nomination) {
    throw Object.assign(new Error('VC nomination not found.'), { status: 404 });
  }
  return nomination;
}
