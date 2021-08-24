const Service = require('egg').Service;
const helper = require('../extend/help');
const encrypt = require('../extend/encrypt');
/**
 * 充值相关
 */
class ChargeAmountService extends Service {


    /**
     * 更新充值金额
     * @param user
     * @param amount
     * @returns {Promise.<boolean>}
     */
    async updateAmount(user, amount) {
        let month = helper.getMonth();
        let chargeKey;
        if(user.identify_state == 1){
            chargeKey = user.identify;
        }else if (user.identify_state == 2){
            chargeKey = user.user_id;
        }else{
            return false;
        }
        let antiAddictionKit = this.app.mysql.get('anti_addiction_kit_server');
        await antiAddictionKit.beginTransactionScope(async conn => {
            const result = await conn.query('update charge_amounts set amount = amount + ? where charge_key = ? and month = ? ', [amount, chargeKey, month]);
            if(result.affectedRows === 0){
                const insert_result = await conn.insert('charge_amounts', {amount, charge_key: chargeKey, month});
                if(insert_result.affectedRows == 0){
                    return false;
                }

            }
        }, this.ctx);
        return true;
    }

    /**
     * 检查是否能充值
     * @param user
     * @param amount
     * @returns {Promise.<*>}
     */
    async checkPay(user, amount) {
        const REASON = {
            1: {'title': '健康消费提醒', 'description' : '根据国家相关规定，当前您无法使用充值相关功能。'},
            2: {'title': '健康消费提醒', 'description' : '根据国家相关规定，您本次付费金额超过规定上限，无法购买。请适度娱乐，理性消费。'},
            3: {'title': '健康消费提醒', 'description' : '购买此商品后，您当月交易的累计总额已达上限 200 元。根据国家相关规定，当月已无法再使用充值相关功能。请适度娱乐，理性消费。'},
            4: {'title': '健康消费提醒', 'description' : '购买此商品后，您当月交易的累计总额已达上限 400 元。根据国家相关规定，当月已无法再使用充值相关功能。请适度娱乐，理性消费。'},
            5: {'title': '健康消费提醒', 'description' : '您当前未登记实名信息。根据国家相关规定，游戏用户需使用真实有效身份信息登记。请前往用户中心-账号安全进行实名登记。'}
        };
        let antiAddictionKit = this.app.mysql.get('anti_addiction_kit_server');
        let switchs = await antiAddictionKit.get('switchs', {id: 1});
        let month = helper.getMonth();
        if(user.identify_state == 1){
            let identify = user.identify;
            if(identify.length == 0){
                return REASON[5];
            }
            let age = helper.getAge(encrypt.decrypt(identify));
            if (age < 8) {
                return REASON[1];
            } else {
                let total_amount = await antiAddictionKit.get('charge_amounts', {charge_key: identify, month});
                if(total_amount !== null){
                    total_amount = total_amount.amount;
                }else{
                    total_amount = 0;
                }
                if (age >= 8 && age < 16) {
                    if (amount > switchs.teen_pay_limit) {
                        return REASON[2];
                    }
                    if (Number(total_amount) + Number(amount) > switchs.teen_month_pay_limit) {
                        return REASON[3];
                    }

                } else if (age >= 16 && age < 18) {
                    if (amount > switchs.young_pay_limit) {
                        return REASON[2];
                    }
                    if (Number(total_amount) + Number(amount) > switchs.young_month_pay_limit) {
                        return REASON[4];
                    }
                }
            }
        }else if (user.identify_state == 2){
            if(user.account_type == 0){
                return REASON[5];
            }else{
                let total_amount = await antiAddictionKit.get('charge_amounts', {charge_key: user.user_id, month});
                if(total_amount !== null){
                    total_amount = total_amount.amount;
                }else{
                    total_amount = 0;
                }
                if (user.account_type == 1) {
                    return REASON[1];
                }else if (user.account_type == 2){
                    if (amount > switchs.teen_pay_limit) {
                        return REASON[2];
                    }
                    if (Number(total_amount) + Number(amount) > switchs.teen_month_pay_limit) {
                        return REASON[3];
                    }
                }else if (user.account_type == 3){
                    if (amount > switchs.young_pay_limit) {
                        return REASON[2];
                    }
                    if (Number(total_amount) + Number(amount) > switchs.young_month_pay_limit) {
                        return REASON[4];
                    }
                }
            }
        }else{
            return REASON[5];
        }
        return true;
    }
}

module.exports = ChargeAmountService;
