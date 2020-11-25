import React, { PropTypes } from 'react';
import { createClassFromSpec } from 'react-vega';

export default createClassFromSpec('LineChart', {
    "width": 400,
    "height": 200,
    "data": [{ "name": "table" }],
    "signals": [
        {
            "name": "tooltip",
            "value": {},
            "on": [
                {"events": "rect:mouseover", "update": "datum"},
                {"events": "rect:mouseout",  "update": "{}"}
            ]
        }
    ],
});
