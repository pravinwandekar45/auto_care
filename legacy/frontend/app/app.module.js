// Change this to wherever your backend folder is served from, e.g.
// "http://localhost/project/backend/api"
const API_BASE = "http://localhost/project/backend/api";

// TEMP: hardcode an owner id until login is wired into this page.
// Once auth.php login works, store the logged-in user's id (e.g. via a shared Angular service)
// and use that instead of this constant.
const CURRENT_OWNER_ID = 1;

angular.module('vehiclePortalApp', [])
    .controller('VehicleController', ['$http', function ($http) {
        const vm = this;
        vm.vehicles = [];
        vm.newVehicle = {};

        vm.loadVehicles = function () {
            $http.get(`${API_BASE}/vehicles.php?owner_id=${CURRENT_OWNER_ID}`)
                .then(function (res) {
                    vm.vehicles = res.data;
                })
                .catch(function (err) {
                    console.error("Failed to load vehicles", err);
                });
        };

        vm.addVehicle = function () {
            const payload = angular.copy(vm.newVehicle);
            payload.owner_id = CURRENT_OWNER_ID;

            $http.post(`${API_BASE}/vehicles.php`, payload)
                .then(function () {
                    vm.newVehicle = {};
                    vm.loadVehicles();
                })
                .catch(function (err) {
                    console.error("Failed to add vehicle", err);
                });
        };

        vm.deleteVehicle = function (id) {
            $http.delete(`${API_BASE}/vehicles.php?id=${id}`)
                .then(function () {
                    vm.loadVehicles();
                });
        };

        vm.loadVehicles();
    }]);
