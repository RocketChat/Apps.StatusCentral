import { UserUtility } from './../utils/users';

import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';

export class IncidentAbortWorker {
    public async abort(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, context.getSender().id);
        const assoc2 = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, context.getRoom().id);
        const existing = await read.getPersistenceReader().readByAssociations([assoc, assoc2]);

        if (existing.length <= 0) {
            const msg = modify.getCreator().startMessage()
                .setUsernameAlias('RC Status')
                .setRoom(context.getRoom())
                .setText('You were not creating an incident to abort.');

            await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
            return;
        }

        await persis.removeByAssociations([assoc, assoc2]);

        const mb = modify.getCreator().startMessage()
                    .setText(`@${ context.getSender().username } has stopped creating the incident.`)
                    .setRoom(context.getRoom())
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        await modify.getCreator().finish(mb);
    }
}
