'use strict';

angular.module('app', [], function () {}).controller('homeCtl', function ($http, $scope) {
  $http.get('api/latest/api-docs').then(function (response) {
    $scope.apiversion = response.data.info.version;
  });

  $http.get('api/info').then(function (response) {
    $scope.version = response.data.version;
  });

  $scope.previousversions = [1, 2];
});
