import { IContainer } from './../models/container';
import { IIncidentModel } from './../models/incident';
import { RcStatusApp } from './../RcStatusApp';
import { UserUtility } from './../utils/users';

import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAction, IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { StepEnum } from '../enums/step';

export class IncidentCreationWorker {
    private app: RcStatusApp;

    constructor(app: RcStatusApp) {
        this.app = app;
    }

    public async start(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, context.getSender().id);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, context.getRoom().id);
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc]);

        if (existing.length > 0) {
            const msg = modify.getCreator().startMessage()
                .setUsernameAlias('RC Status')
                .setRoom(context.getRoom())
                .setText('You are already creating an incident. Please abort if you wish to start over.');

            await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
            return;
        }

        const title = context.getArguments().slice(1, context.getArguments().length).join(' ');
        this.app.getLogger().log(`Starting incident creation of: ${ title }`);

        const container: IContainer = {
            step: StepEnum.Creation,
            userId: userAssoc.getID(),
            roomId: roomAssoc.getID(),
            data: {
                time: new Date(),
                title,
            },
        };

        await persis.createWithAssociations(container, [userAssoc, roomAssoc]);

        const services = await this.app.getHttpWorker().retrieveServices(read, http);

        const mb = modify.getCreator().startMessage()
                    .setText('Please select the services which are affected.')
                    .setRoom(context.getRoom())
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        // Attachment for the services
        const attach: IMessageAttachment = {
            color: '#fe117a',
            actions: [],
        };

        const params = `?userId=${ userAssoc.getID() }&roomId=${ roomAssoc.getID() }`;
        const siteUrl = await read.getEnvironmentReader().getServerSettings().getValueById('Site_Url') as string;
        services.forEach((s) => {
            if (!attach || !attach.actions) {
                return;
            }

            attach.actions.push({
                type: 'button',
                text: s.name,
                url: `${ siteUrl }api/apps/public/${ this.app.getID() }/service${ params }&service=${ s.name }`,
            });
        });

        mb.addAttachment(attach);

        // Attachment for the finish button
        const finishAttach: IMessageAttachment = {
            color: '#551a8b',
            actions: [{
                type: 'button',
                text: 'Next Step',
                url: `${ siteUrl }api/apps/public/${ this.app.getID() }/process${ params }&step=${ StepEnum.Status }`,
            }],
        };

        mb.addAttachment(finishAttach);

        this.app.getLogger().log(mb.getMessage());

        await modify.getCreator().finish(mb);

        return;
    }
}
