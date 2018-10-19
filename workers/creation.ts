import { IIncidentModel } from './../models/incident';
import { RcStatusApp } from './../RcStatusApp';
import { UserUtility } from './../utils/users';

import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAction, IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';

export class IncidentCreationWorker {
    private app: RcStatusApp;

    constructor(app: RcStatusApp) {
        this.app = app;
    }

    public async start(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, context.getSender().id);
        const existing = await read.getPersistenceReader().readByAssociation(assoc);

        if (existing.length > 0) {
            const msg = modify.getCreator().startMessage().setUsernameAlias('RC Status')
                .setText('You are already creating an incident. Please abort if you wish to start over.');

            await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
            return;
        }

        const title = context.getArguments().slice(1, context.getArguments().length).join(' ');
        this.app.getLogger().log(`Starting incident creation of: ${ title }`);

        const data: Partial<IIncidentModel> = {
            time: new Date(),
            title,
        };

        await persis.createWithAssociation(data, assoc);

        const services = await this.app.getHttpWorker().retrieveServices(read, http);

        const mb = modify.getCreator().startMessage()
                    .setText('Please select the services which are affected.')
                    .setRoom(context.getRoom())
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        const attach: IMessageAttachment = {
            color: '#fe117a',
            actions: [],
        };

        services.forEach((s) => {
            if (!attach || !attach.actions) {
                return;
            }

            const act: IMessageAction = {
                msg: s.name,
                msg_in_chat_window: true,
            };

            attach.actions.push(act);
        });

        mb.addAttachment(attach);

        await modify.getCreator().finish(mb);

        return;
    }
}
