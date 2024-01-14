const mongoose = require('mongoose');

/**
 * Cursor-based pagination function for Mongoose models.
 * @param {Model<Document>} Model - The Mongoose model to paginate.
 * @param {Object} query - Optional query conditions.
 * @param {string} cursor - The cursor representing the last record in the previous page.
 * @param {number} [pageSize=defaultPageSize] - Number of results per page (default is 10).
 * @returns {Promise<PaginateResult<Document>>} - An object containing paginated results and metadata.
 */
async function paginateWithCursor(
    Model,
    query,
    cursor,
    pageSize = 10
) {
    try {
        const conditions = cursor ? { _id: { $lt: new mongoose.Types.ObjectId(cursor) } } : {};
        const results = await Model.find({ ...conditions, ...query })
            .sort({ _id: -1 })
            .limit(pageSize + 1);

        const hasNext = results.length > pageSize;
        if (hasNext) {
            results.pop();
        }

        const nextPageCursor = hasNext ? results[results.length - 1]._id : null;
        const previousPageCursor = cursor || null;

        const pagination = {
            next: nextPageCursor ? nextPageCursor.toString() : null,
            prev: previousPageCursor ? previousPageCursor.toString() : null,
        }

        if (pagination.prev === null) {
            delete pagination.prev;
        } else if (pagination.next === null) {
            delete pagination.next;
        }

        return {
            results,
            pagination,
            hasNext,
        };
    } catch (error) {
        throw error;
    }
}

/**
 * Offset pagination function for Mongoose models.
 * @param {mongoose.Model} Model - The Mongoose model to paginate.
 * @param {Object} [filter] - Optional filter conditions.
 * @param {Object} [options] - Pagination options.
 * @param {number} [options.page=1] - The current page number (default is 1).
 * @param {number} [options.perPage=10] - Number of results per page (default is 10).
 * @param {string} [options.sortField] - The field to sort results by.
 * @param {number} [options.sortDirection=1] - Sort direction (1 for ascending, -1 for descending).
 * @returns {Promise<Object>} - An object containing paginated results and metadata.
 */
async function paginateWithOffset(
    Model,
    filter = {},
    options = {}
) {
    const { page = 1, perPage = 10, sortField, sortDirection = 1 } = options;

    const query = Model.find(filter);

    if (sortField) {
        const sortOrder = sortDirection === 1 ? 'asc' : 'desc';
        query.sort({ [sortField]: sortOrder });
    }

    const countPipeline = [
        { $match: filter },
        { $group: { _id: null, count: { $sum: 1 } } }
    ];

    const countResult = await Model.aggregate(countPipeline);

    const total = countResult.length > 0 ? countResult[0].count : 0;

    const totalPages = Math.ceil(total / perPage);

    const skip = (page - 1) * perPage;
    const results = await query.skip(skip).limit(perPage).exec();

    const remainingItems = total - (page) * perPage;
    const actualPageSize = Math.min(perPage, remainingItems);

    const pagination = {
        next: page < totalPages ? { page: page + 1, size: actualPageSize } : null,
        prev: page === 1 ? null : { page: page - 1, size: perPage },
    };

    if (pagination.prev === null) {
        delete pagination.prev;
    } else if (pagination.next === null) {
        delete pagination.next;
    }

    return {
        results,
        pagination,
        page,
        perPage,
        total,
        totalPages,
    };
}


module.exports = {
    paginateWithCursor,
    paginateWithOffset
};
