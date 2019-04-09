import { ServiceStatusEnum } from '../enums/serviceStatus';
import { SettingsEnum } from '../enums/settings';
import { StepEnum } from '../enums/step';
import { RoomUtility } from '../utils/rooms';
import { IncidentStatusEnum } from './../enums/incidentStatus';
import { IContainer } from './../models/container';
import { IIncidentUpdateModel } from './../models/incidentUpdate';
import { RcStatusApp } from './../RcStatusApp';
import { UrlUtils } from './../utils/urls';
import { UserUtility } from './../utils/users';

import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAttachment, MessageActionButtonsAlignment, MessageActionType , MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { IServiceModel } from '../models/service';

export class IncidentCreationWorker {
    private app: RcStatusApp;

    constructor(app: RcStatusApp) {
        this.app = app;
    }

    public async start(context: SlashCommandContext, read: IRead, modify: IModify, persis: IPersistence): Promise<void> {
        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, context.getSender().id);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, context.getRoom().id);
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc]);

        if (existing.length > 0) {
            const msg = modify.getCreator().startMessage()
                .setGroupable(false)
                .setUsernameAlias('RC Status')
                .setRoom(context.getRoom())
                .setText('You are already creating an incident. Please abort if you wish to start over.');

            await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
            return;
        }

        const title = context.getArguments().slice(1, context.getArguments().length).join(' ');
        this.app.getLogger().log(`Starting incident creation of: ${ title }`);

        const container: Partial<IContainer> = {
            step: StepEnum.Creation,
            userId: userAssoc.getID(),
            roomId: roomAssoc.getID(),
            data: {
                time: new Date(),
                title,
            },
        };

        await persis.createWithAssociations(container, [userAssoc, roomAssoc]);

        const mb = modify.getCreator().startMessage()
                    .setText(`@${ context.getSender().username } has started creating an incident.\n\nPlease select the status of the incident:`)
                    .setRoom(context.getRoom())
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        const attach: IMessageAttachment = {
            color: '#00aaff',
            timestamp: new Date(),
            title: {
                value: 'Incident Status',
            },
            collapsed: true,
            actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
            actions: [],
        };

        const siteUrl = await read.getEnvironmentReader().getServerSettings().getValueById('Site_Url') as string;
        const params = `?userId=${ container.userId }&roomId=${ container.roomId }`;
        Object.values(IncidentStatusEnum).forEach((s) => {
            if (!attach.actions) {
                return;
            }

            attach.actions.push({
                type: MessageActionType.BUTTON,
                text: s,
                url: UrlUtils.buildSiteUrl(siteUrl, `api/apps/public/${ this.app.getID() }/incident${ params }&status=${ s }`),
            });
        });

        mb.addAttachment(attach);

        const finishAttach: IMessageAttachment = {
            color: '#551a8b',
            actions: [{
                type: MessageActionType.BUTTON,
                text: 'Next Step',
                url: UrlUtils.buildSiteUrl(siteUrl, `api/apps/public/${ this.app.getID() }/process${ params }&step=${ StepEnum.Describe }`),
            }],
        };

        mb.addAttachment(finishAttach);

        this.app.getLogger().log(mb.getMessage());

        await modify.getCreator().finish(mb);

        return;
    }

    public async askForDescribeCommand(data: IContainer, read: IRead, modify: IModify): Promise<void> {
        if (data.step !== StepEnum.Creation) {
            // TODO: Maybe display an error showing except step but show current step?
            return;
        }

        if (!data.data.status) {
            // TODO: Maybe display an error?
            return;
        }

        const mb = modify.getCreator().startMessage()
                    .setText('Now, please provide a description of the incident via the command `/incident describe <details>`')
                    .setRoom(await RoomUtility.getRoom(read, data.roomId))
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        const attach: IMessageAttachment = {
            color: '#a83c0e',
            actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
            actions: [
                {
                    type: MessageActionType.BUTTON,
                    text: 'Describe it',
                    msg: '/incident describe <details>',
                    msg_in_chat_window: true,
                    msg_processing_type: MessageProcessingType.RespondWithMessage,
                },
            ],
        };

        mb.addAttachment(attach);

        this.app.getLogger().log(mb.getMessage());

        await modify.getCreator().finish(mb);
    }

    public async saveDescription(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, context.getSender().id);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, context.getRoom().id);
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc]);

        if (existing.length !== 1) {
            const msg = modify.getCreator().startMessage()
                .setGroupable(false)
                .setUsernameAlias('RC Status')
                .setRoom(context.getRoom())
                .setText('You are not creating an incident to describe.');

            await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
            return;
        }

        const data = existing[0] as IContainer;
        data.step = StepEnum.Describe;

        this.app.getLogger().log(data);

        const update: Partial<IIncidentUpdateModel> = {
            time: data.data.time,
            status: data.data.status,
            message: context.getArguments().slice(1, context.getArguments().length).join(' '),
        };

        if (!data.data.updates) {
            data.data.updates = [];
        }

        data.data.updates.push(update);

        await this.sendServiceSelection(data, read, modify, http);

        await persis.removeByAssociations([userAssoc, roomAssoc]);
        await persis.createWithAssociations(data, [userAssoc, roomAssoc]);
    }

    public async sendServiceSelection(data: IContainer, read: IRead, modify: IModify, http: IHttp): Promise<void> {
        if (data.step !== StepEnum.Describe) {
            return;
        }

        if (!data.data.updates || data.data.updates.length === 0) {
            return;
        }

        let services: Array<IServiceModel>;
        try {
            services = await this.app.getHttpWorker().retrieveServices(read, http);
        } catch (e) {
            const emb = modify.getCreator().startMessage()
                    .setRoom(await RoomUtility.getRoom(read, data.roomId))
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

            emb.setText(`
Description set. Sadly, however, an error occured with the request to retrieve the services:

\`${ e.message }\`

Maybe try again?
            `);

            this.app.getLogger().log(emb.getMessage());

            await modify.getCreator().finish(emb);

            return;
        }

        const mb = modify.getCreator().startMessage()
                    .setText('Description set. Now, it is time to select the services which are affected.')
                    .setRoom(await RoomUtility.getRoom(read, data.roomId))
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        // Attachment for the services
        const attach: IMessageAttachment = {
            color: '#fe117a',
            timestamp: new Date(),
            title: {
                value: 'Service Selection',
            },
            collapsed: true,
            actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
            actions: [],
        };

        const params = `?userId=${ data.userId }&roomId=${ data.roomId }`;
        const siteUrl = await read.getEnvironmentReader().getServerSettings().getValueById('Site_Url') as string;
        services.forEach((s) => {
            if (!attach || !attach.actions) {
                return;
            }

            attach.actions.push({
                type: MessageActionType.BUTTON,
                text: s.name,
                url: UrlUtils.buildSiteUrl(siteUrl, `api/apps/public/${ this.app.getID() }/service${ params }&service=${ s.name }`),
            });
        });

        mb.addAttachment(attach);

        // Attachment for the finish button
        const finishAttach: IMessageAttachment = {
            color: '#551a8b',
            actions: [{
                type: MessageActionType.BUTTON,
                text: 'Next Step',
                url: UrlUtils.buildSiteUrl(siteUrl, `api/apps/public/${ this.app.getID() }/process${ params }&step=${ StepEnum.Status }`),
            }],
        };

        mb.addAttachment(finishAttach);

        this.app.getLogger().log(mb.getMessage());

        await modify.getCreator().finish(mb);
    }

    public async sendStatusSelection(data: IContainer, read: IRead, modify: IModify): Promise<void> {
        if (!data.data.services || data.data.services.length === 0) {
            return;
        }

        data.step = StepEnum.Status;

        const mb = modify.getCreator().startMessage()
                    .setText('Please select the status for each service.')
                    .setRoom(await RoomUtility.getRoom(read, data.roomId))
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        const params = `?userId=${ data.userId }&roomId=${ data.roomId }`;
        const siteUrl = await read.getEnvironmentReader().getServerSettings().getValueById('Site_Url') as string;
        data.data.services.forEach((s) => {
            const att: IMessageAttachment = {
                color: '#ffff00',
                timestamp: new Date(),
                title: {
                    value: s.name,
                },
                collapsed: true,
                actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
                actions: [],
            };

            Object.values(ServiceStatusEnum).forEach((sta) => {
                if (!att.actions) {
                    return;
                }

                att.actions.push({
                    type: MessageActionType.BUTTON,
                    text: sta,
                    url: UrlUtils.buildSiteUrl(siteUrl, `api/apps/public/${ this.app.getID() }/status${ params }&service=${ s.name }&status=${ sta }`),
                });
            });

            mb.addAttachment(att);
        });

        const finishAttach: IMessageAttachment = {
            color: '#551a8b',
            actions: [{
                type: MessageActionType.BUTTON,
                text: 'Next Step',
                url: UrlUtils.buildSiteUrl(siteUrl, `api/apps/public/${ this.app.getID() }/process${ params }&step=${ StepEnum.Review }`),
            }],
        };

        mb.addAttachment(finishAttach);

        this.app.getLogger().log(mb.getMessage());

        await modify.getCreator().finish(mb);
    }

    public async sendDataForReview(data: IContainer, read: IRead, modify: IModify): Promise<void> {
        if (!data.data.services || data.data.services.length === 0 || data.step !== StepEnum.Status) {
            return;
        }

        data.step = StepEnum.Review;

        const mb = modify.getCreator().startMessage()
                    .setText('Please review the incident. Once you have reviewed, hit the publish button to make it live. :smile:')
                    .setRoom(await RoomUtility.getRoom(read, data.roomId))
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        const params = `?userId=${ data.userId }&roomId=${ data.roomId }`;
        const siteUrl = await read.getEnvironmentReader().getServerSettings().getValueById('Site_Url') as string;

        const attach: IMessageAttachment = {
            color: '#00d800',
            timestamp: new Date(),
            title: {
                value: 'Incident Data',
            },
            collapsed: false,
            text: `
\`\`\`
${ JSON.stringify(data.data, null, 2) }
\`\`\`
            `,
        };

        mb.addAttachment(attach);

        const finishAttach: IMessageAttachment = {
            color: '#551a8b',
            actions: [{
                type: MessageActionType.BUTTON,
                text: 'Publish! 🚀',
                url: UrlUtils.buildSiteUrl(siteUrl, `api/apps/public/${ this.app.getID() }/process${ params }&step=${ StepEnum.Publish }`),
            }],
        };

        mb.addAttachment(finishAttach);

        this.app.getLogger().log(mb.getMessage());

        await modify.getCreator().finish(mb);
    }

    public async publishIncident(data: IContainer, read: IRead, modify: IModify, http: IHttp): Promise<boolean> {
        if (!data.data.services || data.data.services.length === 0 || data.step !== StepEnum.Review) {
            return false;
        }

        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);

        const mb = modify.getCreator().startMessage()
                    .setRoom(await RoomUtility.getRoom(read, data.roomId))
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        let result = false;
        try {
            const inc = await this.app.getHttpWorker().createIncident(data.data, read, http);

            data.step = StepEnum.Publish;
            mb.setText(`Incident created (id \`${ inc.id }\`)! https://${ url }/`);

            result = true;
        } catch (e) {
            mb.setText(`
Sadly, an error occured with the request to create the incident:

\`${ e.message }\`

Maybe try again?
`);

        }

        this.app.getLogger().log(mb.getMessage());

        await modify.getCreator().finish(mb);

        return result;
    }
}
