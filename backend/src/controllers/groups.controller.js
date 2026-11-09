const GroupsService = require('../services/groups.service');

const groupsService = new GroupsService();

function sendError(res, error) {
    if (!error.statusCode) {
        console.error(error);
    }

    res.status(error.statusCode || 500).json({
        message: error.statusCode
            ? error.message
            : 'Error interno del servidor'
    });
}

class GroupsController {

    async create(req, res) {
        try {
            const group = await groupsService.create(req.body ?? {}, req.user);
            res.status(201).json(group);
        } catch (error) {
            sendError(res, error);
        }
    }

    async list(req, res) {
        try {
            const groups = await groupsService.list(req.user);
            res.status(200).json(groups);
        } catch (error) {
            sendError(res, error);
        }
    }

    async join(req, res) {
        try {
            const group = await groupsService.join(req.body ?? {}, req.user);
            res.status(201).json(group);
        } catch (error) {
            sendError(res, error);
        }
    }
}

module.exports = GroupsController;