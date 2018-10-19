import { IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

export class UserUtility {
    public static async getRocketCatUser(read: IRead): Promise<IUser> {
        return await read.getUserReader().getByUsername('rocket.cat');
    }
}
