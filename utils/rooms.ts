import { IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';

export class RoomUtility {
    public static async getRoom(read: IRead, id: string): Promise<IRoom> {
        const room = await read.getRoomReader().getById(id);

        if (!room) {
            throw new Error('No room found.');
        }

        return room;
    }
}
