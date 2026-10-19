const Room = require('../models/Room');
const TimetableEntry = require('../models/TimetableEntry');
const roomConfig = require('../../../shared/roomConfig.json');

const displayName = (building, roomNo) => `${building}-${roomNo}`;
const configuredRooms = () => roomConfig.BUILDINGS.flatMap(building => (
  (roomConfig.ROOMS_BY_BUILDING[building] || []).map(roomNo => ({ building, roomNo }))
));

const legacyRoomIdentity = name => {
  const value = String(name || '').trim();
  const explicit = value.match(/^(ATC|LT)[-_ ]?(\d{3})$/i);
  if (explicit) return { building: explicit[1].toUpperCase(), roomNo: explicit[2] };
  const generic = value.match(/^Room\s+(\d{3})$/i);
  if (generic) return { building: 'ATC', roomNo: generic[1] };
  const lab = value.match(/^(?:Computer\s+)?Lab\s+(\d+)$/i);
  if (lab) return { building: 'LT', roomNo: String(Number(lab[1])).padStart(3, '0') };
  return null;
};

async function migrateLegacyRooms() {
  const legacyRooms = await Room.find({ $or: [{ building: { $exists: false } }, { roomNo: { $exists: false } }] }).lean();
  for (const legacy of legacyRooms) {
    const identity = legacyRoomIdentity(legacy.name);
    if (!identity || !roomConfig.ROOMS_BY_BUILDING[identity.building]?.includes(identity.roomNo)) {
      console.warn(`Room migration pending for ${legacy.name || legacy._id}: map it manually to a configured building/room number.`);
      continue;
    }
    const canonical = await Room.findOne({ building: identity.building, roomNo: identity.roomNo });
    if (canonical && canonical._id.toString() !== legacy._id.toString()) {
      await TimetableEntry.updateMany({ room: legacy._id }, { $set: { room: canonical._id } });
      await Room.deleteOne({ _id: legacy._id });
    } else if (!canonical) {
      await Room.updateOne({ _id: legacy._id }, {
        $set: { building: identity.building, roomNo: identity.roomNo, name: displayName(identity.building, identity.roomNo) },
      });
    }
  }
}

async function syncRooms() {
  await Room.updateMany({ name: { $exists: false } }, [{ $set: { name: { $concat: ['$building', '-', '$roomNo'] } } }]);
  await migrateLegacyRooms();
  for (const room of configuredRooms()) {
    await Room.findOneAndUpdate(
      room,
      {
        $set: {
          name: displayName(room.building, room.roomNo),
          type: roomConfig.ROOM_TYPES?.[displayName(room.building, room.roomNo)] || 'classroom',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  try {
    await Room.syncIndexes();
  } catch (error) {
    console.warn(`Room index synchronization pending: ${error.message}`);
  }
  return Room.find({ building: { $in: roomConfig.BUILDINGS } }).sort({ building: 1, roomNo: 1 }).lean();
}

module.exports = { syncRooms, configuredRooms, displayName };
