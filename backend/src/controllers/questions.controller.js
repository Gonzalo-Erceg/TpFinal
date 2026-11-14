const QuestionsService = require('../services/questions.service');

const questionsService = new QuestionsService();

class QuestionsController {
	async create(req, res){
		try{
			const result = await questionsService.create(req.body, req.user);
            res.status(201).json(result);
		}catch(error){
			console.error('ERROR EN QUESTIONS', error)
			res.status(error.statusCode || 500).json({
				message: error.statusCode
					? error.message
					: 'error interno del servidor'
			})
		}
	}
	async list(req, res){
		try{
			const result = await questionsService.list(req.user, req.query)
			res.status(200).json(result)
		}
		catch(error){
            console.error('ERROR EN QUESTIONS', error);
            res.status(error.statusCode || 500).json({
                message: error.statusCode
                    ? error.message
                    : 'Error interno del servidor'
            });
		}
	}
	async delete(req, res){
		try{
			const result = await questionsService.delete(req.params.id, req.user.id);
			res.status(200).json(result)
		}
		catch(error){
			console.error('ERROR EN QUESTIONS', error);
			res.status(error.statusCode || 500).json({
				message: error.statusCode
					? error.message
					: 'Error interno del servidor'
			})
		}
	}
	async update(req, res){
		try{
			const result = await questionsService.update(req.params.id, req.user.id, req.body);
			res.status(200).json(result)
		}
		catch(error){
			console.error('ERROR EN QUESTIONS', error);
			res.status(error.statusCode || 500).json({
				message: error.statusCode
					? error.message
					: 'Error interno del servidor'
			})
		}
	} 
}

module.exports = QuestionsController;